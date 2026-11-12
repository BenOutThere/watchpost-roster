CREATE OR REPLACE FUNCTION public.manager_sign_on(_guard_id uuid, _slot_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE g public.guards; s public.roster_slots; new_id uuid;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'sign_on_guards') THEN RAISE EXCEPTION 'You do not have permission to sign guards on'; END IF;
  SELECT * INTO g FROM public.guards WHERE id = _guard_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Guard not found'; END IF;
  IF g.status = 'suspended' THEN RAISE EXCEPTION '% can''t be signed on — their account is suspended or deleted', g.name; END IF;
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