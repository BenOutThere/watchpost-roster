CREATE OR REPLACE FUNCTION public.sign_off_attendance(_attendance_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE a public.attendance;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Guards are signed off automatically at the end of their shift';
  END IF;
  SELECT * INTO a FROM public.attendance WHERE id = _attendance_id FOR UPDATE;
  IF a.id IS NULL OR a.signed_off_at IS NOT NULL THEN RETURN; END IF;
  UPDATE public.attendance SET signed_off_at = now(), sign_off_method = 'admin_override' WHERE id = _attendance_id;
END $function$;