CREATE OR REPLACE FUNCTION public.list_signup_providers()
RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT c.id, c.name FROM public.contractors c ORDER BY c.name $$;
REVOKE ALL ON FUNCTION public.list_signup_providers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_signup_providers() TO anon, authenticated;
COMMENT ON FUNCTION public.list_signup_providers() IS 'Provider names (no contact details) for the guard self-registration picker.';

REVOKE EXECUTE ON FUNCTION public.guard_sign_on(double precision, double precision, double precision) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.guard_sign_on(double precision, double precision, double precision) IS 'DEPRECATED: guards are signed on only at the Sign-in desk (manager_sign_on / allocate_guard).';

CREATE OR REPLACE FUNCTION public.allocate_guard(_attendance_id uuid, _slot_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE a public.attendance; s public.roster_slots; g public.guards;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'sign_on_guards') THEN RAISE EXCEPTION 'You do not have permission to sign guards on'; END IF;
  SELECT * INTO a FROM public.attendance WHERE id = _attendance_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sign-on not found'; END IF;
  IF a.signed_off_at IS NOT NULL THEN RAISE EXCEPTION 'Guard is signed off'; END IF;
  IF a.slot_id IS NOT NULL THEN RAISE EXCEPTION 'Guard is already on a position'; END IF;
  SELECT * INTO s FROM public.roster_slots WHERE id = _slot_id FOR UPDATE;
  IF NOT FOUND OR s.status <> 'active' THEN RAISE EXCEPTION 'Position not found'; END IF;
  SELECT * INTO g FROM public.guards WHERE id = a.guard_id;
  IF NOT public.can_access_contractor(s.contractor_id) THEN RAISE EXCEPTION 'That position belongs to another contractor'; END IF;
  IF NOT (public.is_event_staff(auth.uid()) OR public.is_contractor_member(auth.uid(), g.contractor_id)) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF EXISTS (SELECT 1 FROM public.attendance WHERE slot_id = _slot_id AND signed_off_at IS NULL) THEN RAISE EXCEPTION 'That position is already filled'; END IF;
  UPDATE public.attendance SET slot_id = _slot_id, event_id = s.event_id WHERE id = _attendance_id;
  INSERT INTO public.roster_change_log (event_id, slot_id, change_type, summary, after, actor_user_id, actor_name)
  VALUES (s.event_id, s.id, 'allocation', g.name || ' allocated to ' || s.position, jsonb_build_object('guard', g.name), auth.uid(), public.actor_name());
END $function$;