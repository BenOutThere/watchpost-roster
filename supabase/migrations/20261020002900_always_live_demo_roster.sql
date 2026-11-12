CREATE OR REPLACE FUNCTION public.roll_demo_shifts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  UPDATE public.roster_slots s
     SET current_start = s.current_start + (floor(extract(epoch FROM now() - s.current_end) / 86400) + 1) * interval '1 day',
         current_end   = s.current_end   + (floor(extract(epoch FROM now() - s.current_end) / 86400) + 1) * interval '1 day'
   WHERE s.shift_ref LIKE 'DEMO-%' AND s.status = 'active' AND s.current_end <= now()
     AND NOT EXISTS (SELECT 1 FROM public.attendance a WHERE a.slot_id = s.id AND a.signed_off_at IS NULL);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.roll_demo_shifts() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.auto_sign_off_due()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c integer;
BEGIN
  UPDATE public.attendance a SET signed_off_at = s.current_end, sign_off_method = 'automatic'
  FROM public.roster_slots s
  WHERE a.slot_id = s.id AND a.signed_off_at IS NULL AND s.current_end <= now();
  GET DIAGNOSTICS c = ROW_COUNT;
  UPDATE public.roster_slots SET temp_redeploy = NULL
  WHERE temp_redeploy IS NOT NULL AND (temp_redeploy->>'until')::timestamptz <= now();
  PERFORM public.close_expired_tracking_sessions();
  PERFORM public.auto_complete_due_shifts();
  PERFORM public.roll_demo_shifts();
  RETURN c;
END $function$;

DO $$
DECLARE
  ev uuid := '179f66ef-3415-4075-a508-1ea9fbfdb867';
  cons uuid[] := ARRAY['38840cc7-1d3a-4282-9f27-a843be193cad','d8e0b8cd-b747-4066-af79-560c2b38257b','40401a79-080b-46b2-bd4e-4ce9ab8f234a']::uuid[];
  codes text[] := ARRAY['NSRG','SHLD','APEX'];
  posts text[][] := ARRAY[['Main Gate Screening','Demo – Main Gates','Crowd Controller'],
                          ['Stage Pit Barrier','Demo – Stage','Crowd Controller'],
                          ['Perimeter Patrol','Demo – Perimeter','Security Officer'],
                          ['Event Control Liaison','Demo – Event Control','Supervisor']];
  day0 timestamptz := date_trunc('day', now() AT TIME ZONE 'Australia/Sydney') AT TIME ZONE 'Australia/Sydney';
  c int; h int; p int; st timestamptz; sid uuid;
BEGIN
  -- Fresh projects don't have the original demo event or providers; skip the demo seed there.
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = ev)
     OR (SELECT count(*) FROM public.contractors WHERE id = ANY(cons)) < 3 THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.roster_slots WHERE shift_ref LIKE 'DEMO-%') THEN RETURN; END IF;
  FOR c IN 1..3 LOOP FOR h IN 0..11 LOOP FOR p IN 1..4 LOOP
    st := day0 + (h * 2) * interval '1 hour';
    INSERT INTO public.roster_slots (event_id, contractor_id, shift_ref, role, position, zone, scope, current_start, current_end)
    VALUES (ev, cons[c], 'DEMO-' || codes[c] || '-' || lpad((h*2)::text, 2, '0') || '-' || p,
            posts[p][3], posts[p][1], posts[p][2], 'Always-live demo shift', st, st + interval '8 hours')
    RETURNING id INTO sid;
    INSERT INTO public.roster_slot_costs (slot_id, event_id, hourly_rate, paid_hours) VALUES (sid, ev, 65, 8);
  END LOOP; END LOOP; END LOOP;
END $$;

SELECT public.roll_demo_shifts();