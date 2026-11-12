CREATE OR REPLACE FUNCTION public.reset_event_roster(_event_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Only a Super Admin can upload a roster'; END IF;
  UPDATE public.attendance SET slot_id = NULL WHERE slot_id IN (SELECT id FROM public.roster_slots WHERE event_id = _event_id);
  DELETE FROM public.sms_recipients WHERE message_id IN (SELECT m.id FROM public.sms_messages m JOIN public.variations v ON v.id = m.variation_id WHERE v.event_id = _event_id);
  DELETE FROM public.sms_messages WHERE variation_id IN (SELECT id FROM public.variations WHERE event_id = _event_id);
  DELETE FROM public.roster_change_log WHERE event_id = _event_id;
  DELETE FROM public.variations WHERE event_id = _event_id;
  DELETE FROM public.roster_versions WHERE event_id = _event_id;
  DELETE FROM public.roster_slots WHERE event_id = _event_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $function$;

-- Roster positions are created only by a Super Admin upload (variations add positions through approve_variation, which runs with definer rights).
DROP POLICY IF EXISTS "manage slots" ON public.roster_slots;
CREATE POLICY "super admin manages slots" ON public.roster_slots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "manage versions" ON public.roster_versions;
CREATE POLICY "super admin adds versions" ON public.roster_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));