-- When an approved variation changes the finish time of a shift that has already been
-- signed off automatically, move the recorded automatic sign-off to the new finish
-- (only when the new finish has already passed), so attendance reflects the approved hours.
CREATE OR REPLACE FUNCTION public.roster_slot_sync_auto_sign_off()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.current_end IS DISTINCT FROM OLD.current_end AND NEW.current_end <= now() THEN
    UPDATE public.attendance
       SET signed_off_at = GREATEST(NEW.current_end, signed_on_at)
     WHERE slot_id = NEW.id
       AND signed_off_at IS NOT NULL
       AND sign_off_method IN ('auto', 'automatic');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS roster_slot_sync_auto_sign_off ON public.roster_slots;
CREATE TRIGGER roster_slot_sync_auto_sign_off
AFTER UPDATE OF current_end ON public.roster_slots
FOR EACH ROW EXECUTE FUNCTION public.roster_slot_sync_auto_sign_off();