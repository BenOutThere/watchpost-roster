
CREATE OR REPLACE FUNCTION public.actor_name() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT full_name FROM public.profiles WHERE user_id = auth.uid() LIMIT 1), (SELECT email FROM auth.users WHERE id = auth.uid()), 'System');
$$;

CREATE OR REPLACE FUNCTION public.acknowledge_variation(_id uuid, _comments text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.variations;
BEGIN
  SELECT * INTO v FROM public.variations WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Variation not found'; END IF;
  IF NOT public.can_access_contractor(v.contractor_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF v.status NOT IN ('awaiting_ack','requested','returned') THEN RAISE EXCEPTION 'Variation is not awaiting acknowledgement'; END IF;
  UPDATE public.variations SET status = 'awaiting_approval', ack_by_user = auth.uid(), ack_by_name = public.actor_name(), ack_at = now(), ack_comments = _comments WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.decide_variation(_id uuid, _decision text, _notes text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.variations;
BEGIN
  IF NOT public.is_roster_manager(auth.uid()) THEN RAISE EXCEPTION 'Only event managers can decline or return variations'; END IF;
  IF _decision NOT IN ('declined','returned') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  SELECT * INTO v FROM public.variations WHERE id = _id FOR UPDATE;
  IF v.applied_at IS NOT NULL OR v.status = 'approved' THEN RAISE EXCEPTION 'Variation already approved'; END IF;
  UPDATE public.variations SET status = _decision, decision_notes = _notes, approved_by_user = auth.uid(), approved_by_name = public.actor_name(), approved_at = now() WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.approve_variation(_id uuid, _notes text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.variations; s public.roster_slots; target public.roster_slots;
  p jsonb; n integer; i integer; nextver integer; who text := public.actor_name();
BEGIN
  IF NOT public.is_roster_manager(auth.uid()) THEN RAISE EXCEPTION 'Only event managers can approve variations'; END IF;
  SELECT * INTO v FROM public.variations WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Variation not found'; END IF;
  IF v.applied_at IS NOT NULL THEN RAISE EXCEPTION 'Variation has already been applied'; END IF;
  IF v.status <> 'awaiting_approval' THEN RAISE EXCEPTION 'Contractor acknowledgement is required before approval'; END IF;
  p := v.proposed;

  IF v.variation_type = 'time' THEN
    SELECT * INTO s FROM public.roster_slots WHERE id = v.slot_id FOR UPDATE;
    IF s.updated_at > v.created_at AND s.current_end::text <> COALESCE(v.original->>'end', s.current_end::text) AND (v.original->>'end') IS NOT NULL AND s.current_end <> (v.original->>'end')::timestamptz THEN
      RAISE EXCEPTION 'This shift was changed by another approved variation after this request was made. Please return it for review.';
    END IF;
    UPDATE public.roster_slots SET current_start = COALESCE((p->>'start')::timestamptz, current_start), current_end = COALESCE((p->>'end')::timestamptz, current_end), version = version + 1, source_variation_id = v.id WHERE id = s.id;
    INSERT INTO public.roster_change_log (event_id, slot_id, variation_id, change_type, summary, before, after, actor_user_id, actor_name)
    VALUES (v.event_id, s.id, v.id, 'time', v.ref || ': shift times changed', jsonb_build_object('start', s.current_start, 'end', s.current_end), jsonb_build_object('start', COALESCE((p->>'start')::timestamptz, s.current_start), 'end', COALESCE((p->>'end')::timestamptz, s.current_end)), auth.uid(), who);

  ELSIF v.variation_type = 'redeploy' THEN
    SELECT * INTO s FROM public.roster_slots WHERE id = v.slot_id FOR UPDATE;
    IF (p->>'target_slot_id') IS NOT NULL THEN
      SELECT * INTO target FROM public.roster_slots WHERE id = (p->>'target_slot_id')::uuid FOR UPDATE;
      IF EXISTS (SELECT 1 FROM public.attendance WHERE slot_id = target.id AND signed_off_at IS NULL) THEN RAISE EXCEPTION 'Destination position is already filled'; END IF;
      UPDATE public.roster_slots SET assigned_guard_id = s.assigned_guard_id, assigned_guard_name = s.assigned_guard_name, version = version + 1, source_variation_id = v.id WHERE id = target.id;
      UPDATE public.roster_slots SET assigned_guard_id = NULL, assigned_guard_name = NULL, version = version + 1, source_variation_id = v.id WHERE id = s.id;
      UPDATE public.attendance SET slot_id = target.id WHERE slot_id = s.id AND signed_off_at IS NULL;
      INSERT INTO public.roster_change_log (event_id, slot_id, variation_id, change_type, summary, before, after, actor_user_id, actor_name)
      VALUES (v.event_id, s.id, v.id, 'redeploy', v.ref || ': guard moved to ' || target.position || ' (' || target.zone || '); this position is now vacant', jsonb_build_object('guard', s.assigned_guard_name), NULL, auth.uid(), who),
             (v.event_id, target.id, v.id, 'redeploy', v.ref || ': guard redeployed here from ' || s.position, NULL, jsonb_build_object('guard', s.assigned_guard_name), auth.uid(), who);
    ELSIF (p->>'until') IS NOT NULL THEN
      UPDATE public.roster_slots SET temp_redeploy = jsonb_build_object('role', p->>'role', 'position', p->>'position', 'zone', p->>'zone', 'from', COALESCE(p->>'from', now()::text), 'until', p->>'until', 'variation_ref', v.ref), version = version + 1, source_variation_id = v.id WHERE id = s.id;
      INSERT INTO public.roster_change_log (event_id, slot_id, variation_id, change_type, summary, before, after, actor_user_id, actor_name)
      VALUES (v.event_id, s.id, v.id, 'redeploy', v.ref || ': temporarily redeployed to ' || COALESCE(p->>'position','') || ' / ' || COALESCE(p->>'zone',''), jsonb_build_object('role', s.role, 'position', s.position, 'zone', s.zone), p, auth.uid(), who);
    ELSE
      UPDATE public.roster_slots SET role = COALESCE(NULLIF(p->>'role',''), role), position = COALESCE(NULLIF(p->>'position',''), position), zone = COALESCE(NULLIF(p->>'zone',''), zone), scope = COALESCE(NULLIF(p->>'scope',''), scope), version = version + 1, source_variation_id = v.id WHERE id = s.id;
      INSERT INTO public.roster_change_log (event_id, slot_id, variation_id, change_type, summary, before, after, actor_user_id, actor_name)
      VALUES (v.event_id, s.id, v.id, 'redeploy', v.ref || ': redeployed to ' || COALESCE(p->>'position','') || ' / ' || COALESCE(p->>'zone',''), jsonb_build_object('role', s.role, 'position', s.position, 'zone', s.zone), p, auth.uid(), who);
    END IF;

  ELSIF v.variation_type = 'additional' THEN
    n := GREATEST(1, COALESCE((p->>'count')::int, 1));
    FOR i IN 1..n LOOP
      INSERT INTO public.roster_slots (event_id, contractor_id, shift_ref, role, position, zone, scope, current_start, current_end, is_additional, source_variation_id)
      VALUES (v.event_id, v.contractor_id, v.ref || '-' || i, COALESCE(p->>'role',''), COALESCE(p->>'position',''), COALESCE(p->>'zone',''), 'Additional approved scope (' || v.ref || ')', (p->>'start')::timestamptz, (p->>'end')::timestamptz, true, v.id)
      RETURNING * INTO target;
      INSERT INTO public.roster_change_log (event_id, slot_id, variation_id, change_type, summary, after, actor_user_id, actor_name)
      VALUES (v.event_id, target.id, v.id, 'additional', v.ref || ': additional position created', to_jsonb(target), auth.uid(), who);
    END LOOP;
  END IF;

  UPDATE public.variations SET status = 'approved', approved_by_user = auth.uid(), approved_by_name = who, approved_at = now(), decision_notes = _notes, applied_at = now() WHERE id = v.id;
  SELECT COALESCE(max(version),0) + 1 INTO nextver FROM public.roster_versions WHERE event_id = v.event_id;
  INSERT INTO public.roster_versions (event_id, version, kind, label, variation_id, slot_count, created_by)
  VALUES (v.event_id, nextver, 'current', 'Current Approved Roster v' || nextver || ' (' || v.ref || ')', v.id, (SELECT count(*) FROM public.roster_slots WHERE event_id = v.event_id AND status = 'active'), auth.uid());
END $$;

-- Sign on by the guard themselves
CREATE OR REPLACE FUNCTION public.guard_sign_on(_lat double precision DEFAULT NULL, _lng double precision DEFAULT NULL, _accuracy double precision DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.guards; s public.roster_slots; new_id uuid;
BEGIN
  SELECT * INTO g FROM public.guards WHERE user_id = auth.uid() LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No guard profile found for this account'; END IF;
  IF EXISTS (SELECT 1 FROM public.attendance WHERE guard_id = g.id AND signed_off_at IS NULL) THEN RAISE EXCEPTION 'You are already signed on'; END IF;
  SELECT * INTO s FROM public.roster_slots r
  WHERE r.assigned_guard_id = g.id AND r.status = 'active' AND now() BETWEEN r.current_start - interval '2 hours' AND r.current_end
    AND NOT EXISTS (SELECT 1 FROM public.attendance a WHERE a.slot_id = r.id AND a.signed_off_at IS NULL)
  ORDER BY r.current_start LIMIT 1;
  INSERT INTO public.attendance (event_id, guard_id, slot_id, latitude, longitude, accuracy, sign_on_method, signed_on_by)
  VALUES (s.event_id, g.id, s.id, _lat, _lng, _accuracy, 'mobile', auth.uid()) RETURNING id INTO new_id;
  RETURN new_id;
END $$;

-- Manager / contractor signs a guard on (optionally into a slot)
CREATE OR REPLACE FUNCTION public.manager_sign_on(_guard_id uuid, _slot_id uuid DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.guards; s public.roster_slots; new_id uuid;
BEGIN
  SELECT * INTO g FROM public.guards WHERE id = _guard_id;
  IF NOT (public.is_roster_manager(auth.uid()) OR public.is_contractor_member(auth.uid(), g.contractor_id)) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF _slot_id IS NOT NULL THEN SELECT * INTO s FROM public.roster_slots WHERE id = _slot_id FOR UPDATE; END IF;
  INSERT INTO public.attendance (event_id, guard_id, slot_id, sign_on_method, signed_on_by, gps_override_by)
  VALUES (s.event_id, _guard_id, _slot_id, 'manager', auth.uid(), auth.uid()) RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.allocate_guard(_attendance_id uuid, _slot_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.attendance; s public.roster_slots; g public.guards;
BEGIN
  SELECT * INTO a FROM public.attendance WHERE id = _attendance_id FOR UPDATE;
  IF a.signed_off_at IS NOT NULL THEN RAISE EXCEPTION 'Guard is signed off'; END IF;
  SELECT * INTO s FROM public.roster_slots WHERE id = _slot_id FOR UPDATE;
  SELECT * INTO g FROM public.guards WHERE id = a.guard_id;
  IF NOT public.can_access_contractor(s.contractor_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF EXISTS (SELECT 1 FROM public.attendance WHERE slot_id = _slot_id AND signed_off_at IS NULL) THEN RAISE EXCEPTION 'That position is already filled'; END IF;
  UPDATE public.attendance SET slot_id = _slot_id, event_id = s.event_id WHERE id = _attendance_id;
  UPDATE public.roster_slots SET assigned_guard_id = g.id, assigned_guard_name = g.name WHERE id = _slot_id;
  INSERT INTO public.roster_change_log (event_id, slot_id, change_type, summary, after, actor_user_id, actor_name)
  VALUES (s.event_id, s.id, 'allocation', g.name || ' allocated to ' || s.position, jsonb_build_object('guard', g.name), auth.uid(), public.actor_name());
END $$;

CREATE OR REPLACE FUNCTION public.sign_off_attendance(_attendance_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.attendance; g public.guards;
BEGIN
  SELECT * INTO a FROM public.attendance WHERE id = _attendance_id FOR UPDATE;
  IF a.signed_off_at IS NOT NULL THEN RETURN; END IF;
  SELECT * INTO g FROM public.guards WHERE id = a.guard_id;
  IF NOT (g.user_id = auth.uid() OR public.is_roster_manager(auth.uid()) OR public.is_contractor_member(auth.uid(), g.contractor_id)) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  UPDATE public.attendance SET signed_off_at = now(), sign_off_method = CASE WHEN g.user_id = auth.uid() THEN 'manual_guard' ELSE 'manual_manager' END WHERE id = _attendance_id;
END $$;

-- Server-side automatic sign-off at the latest approved finish time
CREATE OR REPLACE FUNCTION public.auto_sign_off_due() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c integer;
BEGIN
  UPDATE public.attendance a SET signed_off_at = s.current_end, sign_off_method = 'automatic'
  FROM public.roster_slots s
  WHERE a.slot_id = s.id AND a.signed_off_at IS NULL AND s.current_end <= now();
  GET DIAGNOSTICS c = ROW_COUNT;
  UPDATE public.roster_slots SET temp_redeploy = NULL
  WHERE temp_redeploy IS NOT NULL AND (temp_redeploy->>'until')::timestamptz <= now();
  PERFORM public.auto_complete_due_shifts();
  RETURN c;
END $$;

REVOKE EXECUTE ON FUNCTION public.auto_sign_off_due() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.acknowledge_variation(uuid, text), public.decide_variation(uuid, text, text), public.approve_variation(uuid, text), public.guard_sign_on(double precision, double precision, double precision), public.manager_sign_on(uuid, uuid), public.allocate_guard(uuid, uuid), public.sign_off_attendance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_variation(uuid, text), public.decide_variation(uuid, text, text), public.approve_variation(uuid, text), public.guard_sign_on(double precision, double precision, double precision), public.manager_sign_on(uuid, uuid), public.allocate_guard(uuid, uuid), public.sign_off_attendance(uuid) TO authenticated;
