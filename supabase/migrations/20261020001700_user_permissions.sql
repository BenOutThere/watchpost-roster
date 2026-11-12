CREATE TABLE public.user_permissions (
  user_id uuid NOT NULL,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission),
  CONSTRAINT user_permissions_known CHECK (permission IN ('view_dashboard','view_roster','view_costs','view_variations','view_guards','view_sign_in','view_communications','view_settings','request_variations','acknowledge_variations','approve_variations','sign_on_guards','message_guards','manage_guards'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own permissions" ON public.user_permissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super admin manages permissions" ON public.user_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'super_admin')
    OR EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = _user_id AND permission = _permission);
$$;

CREATE OR REPLACE FUNCTION public.is_roster_manager(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_role(_user_id) OR public.has_role(_user_id, 'event_manager') OR public.has_role(_user_id, 'senior_management');
$$;

CREATE OR REPLACE FUNCTION public.is_event_staff(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_roster_manager(_user_id) OR public.has_role(_user_id, 'event_control_assistant');
$$;

CREATE OR REPLACE FUNCTION public.can_access_contractor(_contractor_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_event_staff(auth.uid()) OR public.is_contractor_member(auth.uid(), _contractor_id);
$$;

CREATE OR REPLACE FUNCTION public.can_view_costs(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_permission(_user_id, 'view_costs');
$$;

CREATE OR REPLACE FUNCTION public.can_approve_variations(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_permission(_user_id, 'approve_variations');
$$;

CREATE OR REPLACE FUNCTION public.acknowledge_variation(_id uuid, _comments text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v public.variations;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'acknowledge_variations') THEN RAISE EXCEPTION 'You do not have permission to acknowledge variations'; END IF;
  SELECT * INTO v FROM public.variations WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Variation not found'; END IF;
  IF NOT public.can_access_contractor(v.contractor_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF v.status NOT IN ('awaiting_ack','requested','returned') THEN RAISE EXCEPTION 'Variation is not awaiting acknowledgement'; END IF;
  UPDATE public.variations SET status = 'awaiting_approval', ack_by_user = auth.uid(), ack_by_name = public.actor_name(), ack_at = now(), ack_comments = _comments WHERE id = _id;
END $function$;

CREATE OR REPLACE FUNCTION public.acknowledge_variation_group(_group_id uuid, _comments text DEFAULT NULL::text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record; n integer := 0;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'acknowledge_variations') THEN RAISE EXCEPTION 'You do not have permission to acknowledge variations'; END IF;
  FOR r IN SELECT id, contractor_id FROM public.variations WHERE group_id = _group_id AND status IN ('awaiting_ack','requested','returned') ORDER BY created_at, ref FOR UPDATE LOOP
    IF public.can_access_contractor(r.contractor_id) THEN
      PERFORM public.acknowledge_variation(r.id, _comments);
      n := n + 1;
    END IF;
  END LOOP;
  IF n = 0 THEN RAISE EXCEPTION 'No shifts in this request are waiting for your acknowledgement'; END IF;
  RETURN n;
END $function$;

CREATE OR REPLACE FUNCTION public.decide_variation(_id uuid, _decision text, _notes text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v public.variations;
BEGIN
  IF _decision NOT IN ('declined','returned') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  SELECT * INTO v FROM public.variations WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Variation not found'; END IF;
  IF NOT (public.has_permission(auth.uid(), 'approve_variations')
          OR (public.has_permission(auth.uid(), 'acknowledge_variations') AND public.can_access_contractor(v.contractor_id))) THEN
    RAISE EXCEPTION 'You do not have permission to decline or return variations';
  END IF;
  IF v.applied_at IS NOT NULL OR v.status = 'approved' THEN RAISE EXCEPTION 'Variation already approved'; END IF;
  UPDATE public.variations SET status = _decision, decision_notes = _notes, approved_by_user = auth.uid(), approved_by_name = public.actor_name(), approved_at = now() WHERE id = _id;
END $function$;

CREATE OR REPLACE FUNCTION public.decide_variation_group(_group_id uuid, _decision text, _notes text DEFAULT NULL::text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT id FROM public.variations WHERE group_id = _group_id AND status IN ('awaiting_ack','requested','awaiting_approval','returned') AND applied_at IS NULL ORDER BY created_at, ref FOR UPDATE LOOP
    PERFORM public.decide_variation(r.id, _decision, _notes);
    n := n + 1;
  END LOOP;
  IF n = 0 THEN RAISE EXCEPTION 'No shifts in this request are still pending'; END IF;
  RETURN n;
END $function$;

CREATE OR REPLACE FUNCTION public.manager_sign_on(_guard_id uuid, _slot_id uuid DEFAULT NULL::uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE g public.guards; s public.roster_slots; new_id uuid;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'sign_on_guards') THEN RAISE EXCEPTION 'You do not have permission to sign guards on'; END IF;
  SELECT * INTO g FROM public.guards WHERE id = _guard_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Guard not found'; END IF;
  IF NOT (public.is_event_staff(auth.uid()) OR public.is_contractor_member(auth.uid(), g.contractor_id)) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF EXISTS (SELECT 1 FROM public.attendance WHERE guard_id = _guard_id AND signed_off_at IS NULL) THEN RAISE EXCEPTION '% is already signed on', g.name; END IF;
  IF _slot_id IS NOT NULL THEN
    SELECT * INTO s FROM public.roster_slots WHERE id = _slot_id FOR UPDATE;
    IF NOT FOUND OR s.status <> 'active' THEN RAISE EXCEPTION 'Position not found'; END IF;
    IF NOT public.can_access_contractor(s.contractor_id) THEN RAISE EXCEPTION 'That position belongs to another contractor'; END IF;
    IF EXISTS (SELECT 1 FROM public.attendance WHERE slot_id = _slot_id AND signed_off_at IS NULL) THEN RAISE EXCEPTION 'That position is already filled'; END IF;
  END IF;
  INSERT INTO public.attendance (event_id, guard_id, slot_id, sign_on_method, signed_on_by, gps_override_by)
  VALUES (s.event_id, _guard_id, _slot_id, 'manager', auth.uid(), auth.uid()) RETURNING id INTO new_id;
  IF _slot_id IS NOT NULL THEN
    INSERT INTO public.roster_change_log (event_id, slot_id, change_type, summary, after, actor_user_id, actor_name)
    VALUES (s.event_id, s.id, 'allocation', g.name || ' signed on to ' || s.position, jsonb_build_object('guard', g.name), auth.uid(), public.actor_name());
  END IF;
  RETURN new_id;
END $function$;

DROP POLICY IF EXISTS "request variations" ON public.variations;
CREATE POLICY "request variations" ON public.variations FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'request_variations') AND public.can_access_contractor(contractor_id) AND status = 'awaiting_ack' AND applied_at IS NULL);

DROP POLICY IF EXISTS "read attendance" ON public.attendance;
CREATE POLICY "read attendance" ON public.attendance FOR SELECT USING (public.is_event_staff(auth.uid()) OR public.guard_owns_guard(guard_id) OR EXISTS (SELECT 1 FROM public.guards g WHERE g.id = attendance.guard_id AND public.is_contractor_member(auth.uid(), g.contractor_id)));

CREATE POLICY "event staff read guards" ON public.guards FOR SELECT TO authenticated USING (public.is_event_staff(auth.uid()));

DROP POLICY IF EXISTS "read change log" ON public.roster_change_log;
CREATE POLICY "read change log" ON public.roster_change_log FOR SELECT USING (public.is_event_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.roster_slots s WHERE s.id = roster_change_log.slot_id AND public.can_access_contractor(s.contractor_id)));

DROP POLICY IF EXISTS "read versions" ON public.roster_versions;
CREATE POLICY "read versions" ON public.roster_versions FOR SELECT USING (public.is_event_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.contractor_members m WHERE m.user_id = auth.uid()));

DROP POLICY IF EXISTS "read own membership" ON public.contractor_members;
CREATE POLICY "read own membership" ON public.contractor_members FOR SELECT USING (user_id = auth.uid() OR public.is_event_staff(auth.uid()));

DROP POLICY IF EXISTS "read groups" ON public.guard_groups;
CREATE POLICY "read groups" ON public.guard_groups FOR SELECT USING (public.is_event_staff(auth.uid()) OR (contractor_id IS NOT NULL AND public.is_contractor_member(auth.uid(), contractor_id)));

DROP POLICY IF EXISTS "read sms" ON public.sms_messages;
CREATE POLICY "read sms" ON public.sms_messages FOR SELECT USING (public.is_event_staff(auth.uid()) OR (contractor_id IS NOT NULL AND public.is_contractor_member(auth.uid(), contractor_id)) OR EXISTS (SELECT 1 FROM public.sms_recipients r WHERE r.message_id = sms_messages.id AND public.guard_owns_guard(r.guard_id)));