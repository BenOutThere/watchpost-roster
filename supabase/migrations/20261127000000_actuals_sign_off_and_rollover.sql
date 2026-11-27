-- Final actuals sign-off and roster rollover to the next edition.
--
-- After an event, a Super Admin signs off its final actuals (the roster as it ended, with every
-- approved variation applied, plus who actually signed on and off). The next edition's draft roster
-- is then rolled from those signed-off actuals: every active position, at its final times moved
-- forward by a whole number of days, with the same contractor, role, position, zone and hourly rate
-- (paid hours are left blank for the new edition).
-- Guards are never carried over (positions are never pre-assigned to named guards).
--
-- The new-event workflow (OTG Control Centre) calls these through the `automation` edge function.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS actuals_signed_off_at timestamptz,
  ADD COLUMN IF NOT EXISTS actuals_signed_off_by uuid,
  ADD COLUMN IF NOT EXISTS actuals_signed_off_name text,
  ADD COLUMN IF NOT EXISTS rolled_from_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;

-- Final actuals for one event: one row per active position.
CREATE OR REPLACE FUNCTION public.event_final_actuals_core(_event_id uuid)
RETURNS TABLE (
  slot_id uuid, shift_ref text, contractor_id uuid, contractor_name text, role text, "position" text,
  zone text, scope text, notes text, required boolean, is_additional boolean,
  rostered_start timestamptz, rostered_end timestamptz, rostered_hours numeric,
  signed_on_at timestamptz, signed_off_at timestamptz, worked_hours numeric, guards_signed_on integer,
  hourly_rate numeric
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.shift_ref, s.contractor_id, c.name, s.role, s.position, s.zone, s.scope, s.notes,
         s.required, s.is_additional, s.current_start, s.current_end,
         round((extract(epoch FROM (s.current_end - s.current_start)) / 3600)::numeric, 2),
         a.first_on, a.last_off,
         round(coalesce(a.worked, 0)::numeric, 2),
         coalesce(a.n, 0)::integer,
         sc.hourly_rate
  FROM public.roster_slots s
  LEFT JOIN public.contractors c ON c.id = s.contractor_id
  LEFT JOIN public.roster_slot_costs sc ON sc.slot_id = s.id
  LEFT JOIN LATERAL (
    SELECT min(at.signed_on_at) AS first_on, max(at.signed_off_at) AS last_off, count(*) AS n,
           sum(extract(epoch FROM (coalesce(at.signed_off_at, at.signed_on_at) - at.signed_on_at)) / 3600) AS worked
    FROM public.attendance at WHERE at.slot_id = s.id
  ) a ON true
  WHERE s.event_id = _event_id AND s.status = 'active'
  ORDER BY s.current_start, s.shift_ref;
$$;
REVOKE ALL ON FUNCTION public.event_final_actuals_core(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_final_actuals_core(uuid) TO service_role;

-- Sign off an event's final actuals. Super Admin only (like sign-off overrides and roster uploads).
-- Refused while anyone is still signed on or a variation is still waiting for a decision.
CREATE OR REPLACE FUNCTION public.sign_off_event_actuals_core(_event_id uuid, _by uuid, _by_name text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ev public.events%ROWTYPE; open_n integer; waiting_n integer;
BEGIN
  SELECT * INTO ev FROM public.events WHERE id = _event_id FOR UPDATE;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF ev.actuals_signed_off_at IS NOT NULL THEN RETURN ev.actuals_signed_off_at; END IF;
  SELECT count(*) INTO open_n FROM public.attendance WHERE event_id = _event_id AND signed_off_at IS NULL;
  IF open_n > 0 THEN RAISE EXCEPTION '% guard(s) are still signed on. Sign-offs must finish first.', open_n; END IF;
  SELECT count(*) INTO waiting_n FROM public.variations WHERE event_id = _event_id AND status IN ('requested','awaiting_ack','awaiting_approval','returned');
  IF waiting_n > 0 THEN RAISE EXCEPTION '% variation(s) still need a decision.', waiting_n; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.roster_slots WHERE event_id = _event_id AND status = 'active') THEN
    RAISE EXCEPTION 'This event has no roster to sign off.';
  END IF;
  UPDATE public.events SET actuals_signed_off_at = now(), actuals_signed_off_by = _by, actuals_signed_off_name = _by_name
  WHERE id = _event_id;
  RETURN now();
END $$;
REVOKE ALL ON FUNCTION public.sign_off_event_actuals_core(uuid, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sign_off_event_actuals_core(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.sign_off_event_actuals(_event_id uuid)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nm text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Only a Super Admin can sign off final actuals'; END IF;
  SELECT coalesce(nullif(full_name, ''), email) INTO nm FROM public.profiles WHERE user_id = auth.uid();
  RETURN public.sign_off_event_actuals_core(_event_id, auth.uid(), coalesce(nm, 'Super Admin'));
END $$;
REVOKE ALL ON FUNCTION public.sign_off_event_actuals(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sign_off_event_actuals(uuid) TO authenticated;

-- Roll a signed-off event's final roster into a new event (the next edition) as its Version 1.
-- Never touches the source event. Refuses if the source isn't signed off, or the target already
-- has positions. Returns the new event id.
CREATE OR REPLACE FUNCTION public.rollover_event_roster_core(
  _from_event_id uuid, _name text, _event_date date, _shift_days integer, _by uuid, _target_event_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE src public.events%ROWTYPE; target uuid; n integer; shift interval;
BEGIN
  SELECT * INTO src FROM public.events WHERE id = _from_event_id;
  IF src.id IS NULL THEN RAISE EXCEPTION 'Source event not found'; END IF;
  IF src.actuals_signed_off_at IS NULL THEN
    RAISE EXCEPTION 'Final actuals for "%" have not been signed off yet.', src.name;
  END IF;
  IF _shift_days IS NULL OR abs(_shift_days) > 3660 THEN RAISE EXCEPTION 'shift days must be set (whole days)'; END IF;
  shift := make_interval(days => _shift_days);

  IF _target_event_id IS NOT NULL THEN
    target := _target_event_id;
    IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = target) THEN RAISE EXCEPTION 'Target event not found'; END IF;
  ELSE
    IF coalesce(trim(_name), '') = '' THEN RAISE EXCEPTION 'New event name is required'; END IF;
    INSERT INTO public.events (name, venue, timezone, event_date, gps_required, venue_lat, venue_lng, venue_radius_m, status, rolled_from_event_id)
    VALUES (trim(_name), src.venue, src.timezone, coalesce(_event_date, src.event_date + _shift_days), src.gps_required,
            src.venue_lat, src.venue_lng, src.venue_radius_m, 'active', src.id)
    RETURNING id INTO target;
  END IF;
  IF EXISTS (SELECT 1 FROM public.roster_slots WHERE event_id = target) THEN
    RAISE EXCEPTION 'The target event already has a roster. Nothing was rolled over.';
  END IF;
  UPDATE public.events SET rolled_from_event_id = src.id WHERE id = target AND rolled_from_event_id IS NULL;

  WITH ins AS (
    INSERT INTO public.roster_slots (event_id, contractor_id, shift_ref, role, position, zone, scope, notes,
                                     current_start, current_end, required, is_additional, status, version)
    SELECT target, s.contractor_id, s.shift_ref, s.role, s.position, s.zone, s.scope, s.notes,
           s.current_start + shift, s.current_end + shift, s.required, false, 'active', 1
    FROM public.roster_slots s WHERE s.event_id = src.id AND s.status = 'active'
    RETURNING id, shift_ref
  ), costs AS (
    INSERT INTO public.roster_slot_costs (slot_id, event_id, hourly_rate, paid_hours)
    SELECT ins.id, target, sc.hourly_rate, NULL::numeric
    FROM ins
    JOIN public.roster_slots s ON s.event_id = src.id AND s.shift_ref = ins.shift_ref
    JOIN public.roster_slot_costs sc ON sc.slot_id = s.id
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO n FROM ins;

  INSERT INTO public.roster_versions (event_id, version, kind, label, source_file_name, slot_count, created_by)
  VALUES (target, 1, 'original', 'Original Roster – Version 1 (rolled from ' || src.name || ' final actuals)', NULL, n, _by);
  RETURN target;
END $$;
REVOKE ALL ON FUNCTION public.rollover_event_roster_core(uuid, text, date, integer, uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rollover_event_roster_core(uuid, text, date, integer, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.rollover_event_roster(_from_event_id uuid, _name text, _event_date date, _shift_days integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Only a Super Admin can roll a roster over'; END IF;
  RETURN public.rollover_event_roster_core(_from_event_id, _name, _event_date, _shift_days, auth.uid(), NULL);
END $$;
REVOKE ALL ON FUNCTION public.rollover_event_roster(uuid, text, date, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rollover_event_roster(uuid, text, date, integer) TO authenticated;
