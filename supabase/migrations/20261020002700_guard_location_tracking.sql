
CREATE TABLE public.event_location_settings (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  upload_interval_s integer NOT NULL DEFAULT 30,
  fresh_s integer NOT NULL DEFAULT 90,
  stale_s integer NOT NULL DEFAULT 300,
  low_accuracy_m integer NOT NULL DEFAULT 100,
  notice_version text NOT NULL DEFAULT 'v1',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_name text
);
GRANT SELECT ON public.event_location_settings TO authenticated;
GRANT ALL ON public.event_location_settings TO service_role;
ALTER TABLE public.event_location_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed-in read location settings" ON public.event_location_settings FOR SELECT TO authenticated USING (true);

CREATE TABLE public.guard_location_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id uuid NOT NULL REFERENCES public.guards(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  notice_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz
);
CREATE UNIQUE INDEX guard_location_consents_one_current ON public.guard_location_consents (guard_id, event_id) WHERE withdrawn_at IS NULL;
GRANT SELECT ON public.guard_location_consents TO authenticated;
GRANT ALL ON public.guard_location_consents TO service_role;
ALTER TABLE public.guard_location_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guard reads own consent" ON public.guard_location_consents FOR SELECT TO authenticated
  USING (public.guard_owns_guard(guard_id) OR (public.has_permission(auth.uid(), 'view_locations') AND public.is_event_staff(auth.uid())));

CREATE TABLE public.guard_tracking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id uuid NOT NULL REFERENCES public.guards(id) ON DELETE CASCADE,
  attendance_id uuid NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  contractor_id uuid,
  slot_id uuid REFERENCES public.roster_slots(id) ON DELETE SET NULL,
  consent_id uuid REFERENCES public.guard_location_consents(id),
  device_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  stopped_at timestamptz,
  stop_reason text
);
CREATE UNIQUE INDEX guard_tracking_sessions_one_active ON public.guard_tracking_sessions (guard_id) WHERE stopped_at IS NULL;
CREATE INDEX guard_tracking_sessions_slot ON public.guard_tracking_sessions (slot_id) WHERE stopped_at IS NULL;
GRANT SELECT ON public.guard_tracking_sessions TO authenticated;
GRANT ALL ON public.guard_tracking_sessions TO service_role;
ALTER TABLE public.guard_tracking_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read tracking sessions in scope" ON public.guard_tracking_sessions FOR SELECT TO authenticated
  USING (public.guard_owns_guard(guard_id) OR (public.has_permission(auth.uid(), 'view_locations')
    AND (public.is_event_staff(auth.uid()) OR (contractor_id IS NOT NULL AND public.is_contractor_member(auth.uid(), contractor_id)))));

-- Latest location only: one row per live session, removed when the session closes.
CREATE TABLE public.guard_latest_locations (
  session_id uuid PRIMARY KEY REFERENCES public.guard_tracking_sessions(id) ON DELETE CASCADE,
  guard_id uuid NOT NULL REFERENCES public.guards(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  contractor_id uuid,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  captured_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'browser',
  sample_id text
);
CREATE INDEX guard_latest_locations_event ON public.guard_latest_locations (event_id);
GRANT SELECT ON public.guard_latest_locations TO authenticated;
GRANT ALL ON public.guard_latest_locations TO service_role;
ALTER TABLE public.guard_latest_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read live locations in scope" ON public.guard_latest_locations FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.guard_tracking_sessions s WHERE s.id = session_id AND s.stopped_at IS NULL AND s.expires_at > now())
    AND (public.guard_owns_guard(guard_id) OR (public.has_permission(auth.uid(), 'view_locations')
      AND (public.is_event_staff(auth.uid()) OR (contractor_id IS NOT NULL AND public.is_contractor_member(auth.uid(), contractor_id)))))
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.guard_latest_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guard_tracking_sessions;

-- Close a session and purge its coordinates.
CREATE OR REPLACE FUNCTION public.close_tracking_session(_session_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s public.guard_tracking_sessions;
BEGIN
  UPDATE public.guard_tracking_sessions SET stopped_at = now(), stop_reason = _reason
   WHERE id = _session_id AND stopped_at IS NULL RETURNING * INTO s;
  DELETE FROM public.guard_latest_locations WHERE session_id = _session_id;
  IF s.id IS NOT NULL THEN
    INSERT INTO public.audit_logs (actor_user_id, guard_id, event_type, event_details)
    VALUES (auth.uid(), s.guard_id, 'location_sharing_stopped', jsonb_build_object('session_id', s.id, 'event_id', s.event_id, 'reason', _reason));
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.close_tracking_session(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.start_location_sharing(_notice_version text, _device_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE g public.guards; a public.attendance; sl public.roster_slots; st public.event_location_settings; c_id uuid; s public.guard_tracking_sessions; new_id uuid;
BEGIN
  IF coalesce(btrim(_device_id), '') = '' THEN RAISE EXCEPTION 'Missing device id'; END IF;
  SELECT * INTO g FROM public.guards WHERE user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'No guard profile is linked to this account'; END IF;
  SELECT * INTO a FROM public.attendance WHERE guard_id = g.id AND signed_off_at IS NULL FOR UPDATE;
  IF NOT FOUND OR a.slot_id IS NULL THEN RAISE EXCEPTION 'You need to be signed on to a position at the sign-in desk first'; END IF;
  SELECT * INTO sl FROM public.roster_slots WHERE id = a.slot_id;
  IF sl.current_end <= now() THEN RAISE EXCEPTION 'Your shift has ended'; END IF;
  SELECT * INTO st FROM public.event_location_settings WHERE event_id = sl.event_id;
  IF FOUND AND NOT st.enabled THEN RAISE EXCEPTION 'Location sharing is turned off for this event'; END IF;
  IF _notice_version IS DISTINCT FROM COALESCE(st.notice_version, 'v1') THEN RAISE EXCEPTION 'Please read the latest location notice'; END IF;

  SELECT id INTO c_id FROM public.guard_location_consents WHERE guard_id = g.id AND event_id = sl.event_id AND withdrawn_at IS NULL AND notice_version = _notice_version;
  IF c_id IS NULL THEN
    UPDATE public.guard_location_consents SET withdrawn_at = now() WHERE guard_id = g.id AND event_id = sl.event_id AND withdrawn_at IS NULL;
    INSERT INTO public.guard_location_consents (guard_id, event_id, notice_version) VALUES (g.id, sl.event_id, _notice_version) RETURNING id INTO c_id;
    INSERT INTO public.audit_logs (actor_user_id, guard_id, event_type, event_details)
    VALUES (auth.uid(), g.id, 'location_consent_given', jsonb_build_object('event_id', sl.event_id, 'notice_version', _notice_version));
  END IF;

  SELECT * INTO s FROM public.guard_tracking_sessions WHERE guard_id = g.id AND stopped_at IS NULL FOR UPDATE;
  IF FOUND THEN
    IF s.device_id = _device_id AND s.attendance_id = a.id THEN RETURN s.id; END IF;
    PERFORM public.close_tracking_session(s.id, CASE WHEN s.device_id <> _device_id THEN 'another_device' ELSE 'new_sign_on' END);
  END IF;
  INSERT INTO public.guard_tracking_sessions (guard_id, attendance_id, event_id, contractor_id, slot_id, consent_id, device_id, expires_at)
  VALUES (g.id, a.id, sl.event_id, COALESCE(sl.contractor_id, g.contractor_id), sl.id, c_id, _device_id, sl.current_end) RETURNING id INTO new_id;
  INSERT INTO public.audit_logs (actor_user_id, guard_id, event_type, event_details)
  VALUES (auth.uid(), g.id, 'location_sharing_started', jsonb_build_object('session_id', new_id, 'event_id', sl.event_id));
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.stop_location_sharing(_withdraw_consent boolean DEFAULT false, _reason text DEFAULT 'guard_stopped')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE g public.guards; r record;
BEGIN
  SELECT * INTO g FROM public.guards WHERE user_id = auth.uid();
  IF NOT FOUND THEN RETURN; END IF;
  FOR r IN SELECT id FROM public.guard_tracking_sessions WHERE guard_id = g.id AND stopped_at IS NULL FOR UPDATE LOOP
    PERFORM public.close_tracking_session(r.id, CASE WHEN _reason IN ('guard_stopped','logout','consent_withdrawn') THEN _reason ELSE 'guard_stopped' END);
  END LOOP;
  IF _withdraw_consent THEN
    UPDATE public.guard_location_consents SET withdrawn_at = now() WHERE guard_id = g.id AND withdrawn_at IS NULL;
    INSERT INTO public.audit_logs (actor_user_id, guard_id, event_type, event_details) VALUES (auth.uid(), g.id, 'location_consent_withdrawn', '{}'::jsonb);
  END IF;
END $$;

-- The only way coordinates are written. Identity, event, contractor and position come from server records.
CREATE OR REPLACE FUNCTION public.submit_guard_location(_session_id uuid, _lat double precision, _lng double precision, _accuracy double precision, _captured_at timestamptz, _sample_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s public.guard_tracking_sessions; a public.attendance; sl public.roster_slots; prev public.guard_latest_locations; cons public.guard_location_consents;
BEGIN
  SELECT * INTO s FROM public.guard_tracking_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND OR NOT public.guard_owns_guard(s.guard_id) THEN RETURN jsonb_build_object('ok', false, 'stop', true, 'reason', 'not_your_session'); END IF;
  IF s.stopped_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'stop', true, 'reason', s.stop_reason); END IF;
  SELECT * INTO a FROM public.attendance WHERE id = s.attendance_id;
  IF a.signed_off_at IS NOT NULL THEN PERFORM public.close_tracking_session(s.id, 'signed_off'); RETURN jsonb_build_object('ok', false, 'stop', true, 'reason', 'signed_off'); END IF;
  SELECT * INTO sl FROM public.roster_slots WHERE id = a.slot_id;
  IF sl.id IS NULL OR sl.current_end <= now() THEN PERFORM public.close_tracking_session(s.id, 'shift_ended'); RETURN jsonb_build_object('ok', false, 'stop', true, 'reason', 'shift_ended'); END IF;
  SELECT * INTO cons FROM public.guard_location_consents WHERE id = s.consent_id;
  IF cons.withdrawn_at IS NOT NULL THEN PERFORM public.close_tracking_session(s.id, 'consent_withdrawn'); RETURN jsonb_build_object('ok', false, 'stop', true, 'reason', 'consent_withdrawn'); END IF;
  IF EXISTS (SELECT 1 FROM public.event_location_settings WHERE event_id = s.event_id AND NOT enabled) THEN
    PERFORM public.close_tracking_session(s.id, 'disabled_for_event'); RETURN jsonb_build_object('ok', false, 'stop', true, 'reason', 'disabled_for_event'); END IF;
  IF _lat IS NULL OR _lng IS NULL OR _lat < -90 OR _lat > 90 OR _lng < -180 OR _lng > 180 OR (_lat = 0 AND _lng = 0) THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_coordinates'); END IF;
  IF _accuracy IS NULL OR _accuracy < 0 OR _accuracy > 10000 THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_accuracy'); END IF;
  IF _captured_at IS NULL OR _captured_at > now() + interval '30 seconds' THEN RETURN jsonb_build_object('ok', false, 'reason', 'future_reading'); END IF;
  IF _captured_at < now() - interval '10 minutes' OR _captured_at < s.started_at - interval '1 minute' THEN RETURN jsonb_build_object('ok', false, 'reason', 'too_old'); END IF;
  SELECT * INTO prev FROM public.guard_latest_locations WHERE session_id = s.id;
  IF FOUND THEN
    IF prev.captured_at >= _captured_at THEN RETURN jsonb_build_object('ok', false, 'reason', 'out_of_order'); END IF;
    IF prev.received_at > now() - interval '5 seconds' THEN RETURN jsonb_build_object('ok', false, 'reason', 'throttled'); END IF;
  END IF;
  INSERT INTO public.guard_latest_locations (session_id, guard_id, event_id, contractor_id, latitude, longitude, accuracy, captured_at, received_at, sample_id)
  VALUES (s.id, s.guard_id, s.event_id, s.contractor_id, _lat, _lng, _accuracy, LEAST(_captured_at, now()), now(), left(_sample_id, 80))
  ON CONFLICT (session_id) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, accuracy = EXCLUDED.accuracy,
    captured_at = EXCLUDED.captured_at, received_at = EXCLUDED.received_at, sample_id = EXCLUDED.sample_id;
  RETURN jsonb_build_object('ok', true, 'expires_at', sl.current_end);
END $$;

-- Sign-off (manual override or automatic) closes tracking in the same transaction.
CREATE OR REPLACE FUNCTION public.attendance_close_tracking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record;
BEGIN
  IF NEW.signed_off_at IS NOT NULL AND OLD.signed_off_at IS NULL THEN
    FOR r IN SELECT id FROM public.guard_tracking_sessions WHERE attendance_id = NEW.id AND stopped_at IS NULL FOR UPDATE LOOP
      PERFORM public.close_tracking_session(r.id, 'signed_off');
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER attendance_close_tracking AFTER UPDATE OF signed_off_at ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.attendance_close_tracking();

-- Approved time changes move the tracking cutoff (pending variations never touch roster_slots).
CREATE OR REPLACE FUNCTION public.roster_slot_sync_tracking_expiry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.current_end IS DISTINCT FROM OLD.current_end THEN
    UPDATE public.guard_tracking_sessions SET expires_at = NEW.current_end WHERE slot_id = NEW.id AND stopped_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER roster_slot_sync_tracking_expiry AFTER UPDATE OF current_end ON public.roster_slots FOR EACH ROW EXECUTE FUNCTION public.roster_slot_sync_tracking_expiry();

-- Redeploy to another position keeps the session pointed at the guard's current slot.
CREATE OR REPLACE FUNCTION public.attendance_sync_tracking_slot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.slot_id IS DISTINCT FROM OLD.slot_id AND NEW.slot_id IS NOT NULL AND NEW.signed_off_at IS NULL THEN
    UPDATE public.guard_tracking_sessions s SET slot_id = NEW.slot_id, expires_at = r.current_end
      FROM public.roster_slots r WHERE r.id = NEW.slot_id AND s.attendance_id = NEW.id AND s.stopped_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER attendance_sync_tracking_slot AFTER UPDATE OF slot_id ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.attendance_sync_tracking_slot();

CREATE OR REPLACE FUNCTION public.close_expired_tracking_sessions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT s.id, CASE WHEN a.signed_off_at IS NOT NULL THEN 'signed_off' ELSE 'shift_ended' END AS why
    FROM public.guard_tracking_sessions s JOIN public.attendance a ON a.id = s.attendance_id
    WHERE s.stopped_at IS NULL AND (s.expires_at <= now() OR a.signed_off_at IS NOT NULL) FOR UPDATE OF s LOOP
    PERFORM public.close_tracking_session(r.id, r.why); n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.close_expired_tracking_sessions() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.auto_sign_off_due()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
  RETURN c;
END $function$;

CREATE OR REPLACE FUNCTION public.save_event_location_settings(_event_id uuid, _enabled boolean, _upload_interval_s integer, _fresh_s integer, _stale_s integer, _low_accuracy_m integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Only a Super Admin can change location settings'; END IF;
  IF _upload_interval_s < 10 OR _fresh_s < 30 OR _stale_s <= _fresh_s OR _low_accuracy_m < 10 THEN RAISE EXCEPTION 'Check the numbers: stale must be longer than fresh'; END IF;
  INSERT INTO public.event_location_settings (event_id, enabled, upload_interval_s, fresh_s, stale_s, low_accuracy_m, updated_at, updated_by_name)
  VALUES (_event_id, _enabled, _upload_interval_s, _fresh_s, _stale_s, _low_accuracy_m, now(), public.actor_name())
  ON CONFLICT (event_id) DO UPDATE SET enabled = EXCLUDED.enabled, upload_interval_s = EXCLUDED.upload_interval_s, fresh_s = EXCLUDED.fresh_s,
    stale_s = EXCLUDED.stale_s, low_accuracy_m = EXCLUDED.low_accuracy_m, updated_at = now(), updated_by_name = EXCLUDED.updated_by_name;
  INSERT INTO public.audit_logs (actor_user_id, event_type, event_details)
  VALUES (auth.uid(), 'location_settings_changed', jsonb_build_object('event_id', _event_id, 'enabled', _enabled));
  IF NOT _enabled THEN
    PERFORM public.close_tracking_session(id, 'disabled_for_event') FROM public.guard_tracking_sessions WHERE event_id = _event_id AND stopped_at IS NULL;
  END IF;
END $$;

INSERT INTO public.role_permissions (role, permission)
SELECT r::public.app_role, 'view_locations' FROM unnest(ARRAY['senior_management','event_manager','event_control_assistant','security_manager','security_zone_manager']) r
WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions rp WHERE rp.role = r::public.app_role AND rp.permission = 'view_locations');
