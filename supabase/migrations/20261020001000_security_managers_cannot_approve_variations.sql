CREATE OR REPLACE FUNCTION public.can_approve_variations(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_admin_role(_user_id) OR public.has_role(_user_id, 'event_manager');
$function$;

CREATE OR REPLACE FUNCTION public.approve_variation(_id uuid, _notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v public.variations; s public.roster_slots; target public.roster_slots;
  p jsonb; n integer; i integer; nextver integer; who text := public.actor_name();
BEGIN
  IF NOT public.can_approve_variations(auth.uid()) THEN RAISE EXCEPTION 'Only Admins and Event Managers can approve variations'; END IF;
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
END $function$;