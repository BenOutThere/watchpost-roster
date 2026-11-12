CREATE OR REPLACE FUNCTION public.reset_event_roster(_event_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.is_roster_manager(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  UPDATE public.attendance SET slot_id = NULL WHERE slot_id IN (SELECT id FROM public.roster_slots WHERE event_id = _event_id);
  DELETE FROM public.sms_recipients WHERE message_id IN (SELECT m.id FROM public.sms_messages m JOIN public.variations v ON v.id = m.variation_id WHERE v.event_id = _event_id);
  DELETE FROM public.sms_messages WHERE variation_id IN (SELECT id FROM public.variations WHERE event_id = _event_id);
  DELETE FROM public.roster_change_log WHERE event_id = _event_id;
  DELETE FROM public.variations WHERE event_id = _event_id;
  DELETE FROM public.roster_versions WHERE event_id = _event_id;
  DELETE FROM public.roster_slots WHERE event_id = _event_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.reset_event_roster(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reset_event_roster(uuid) TO authenticated;