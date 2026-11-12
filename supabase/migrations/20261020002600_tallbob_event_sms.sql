-- Encrypted Tall Bob API credentials. Server-only: no grants or policies for app users.
CREATE TABLE public.sms_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'tallbob',
  environment text NOT NULL DEFAULT 'production',
  ciphertext text NOT NULL,
  iv text NOT NULL,
  webhook_token_hash text,
  webhooks_registered_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.sms_credentials FROM anon, authenticated;
GRANT ALL ON public.sms_credentials TO service_role;
ALTER TABLE public.sms_credentials ENABLE ROW LEVEL SECURITY;

-- One SMS configuration per event (no secrets here). Written only by the sms-settings function.
CREATE TABLE public.event_sms_settings (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'tallbob',
  account_name text,
  credential_id uuid REFERENCES public.sms_credentials(id) ON DELETE SET NULL,
  sender_id text,
  environment text NOT NULL DEFAULT 'production',
  enabled boolean NOT NULL DEFAULT false,
  connection_status text NOT NULL DEFAULT 'not_configured',
  last_test_at timestamptz,
  last_test_ok_at timestamptz,
  last_test jsonb,
  credentials_updated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_name text
);
REVOKE ALL ON public.event_sms_settings FROM anon;
GRANT SELECT ON public.event_sms_settings TO authenticated;
GRANT ALL ON public.event_sms_settings TO service_role;
ALTER TABLE public.event_sms_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read event sms settings" ON public.event_sms_settings FOR SELECT TO authenticated
  USING (public.is_event_staff(auth.uid()) OR public.has_permission(auth.uid(), 'manage_sms')
         OR EXISTS (SELECT 1 FROM public.contractor_members m WHERE m.user_id = auth.uid()));

-- Message-level send details.
ALTER TABLE public.sms_messages
  ADD COLUMN event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN credential_id uuid REFERENCES public.sms_credentials(id) ON DELETE SET NULL,
  ADD COLUMN provider text NOT NULL DEFAULT 'tallbob',
  ADD COLUMN provider_account text,
  ADD COLUMN sender_id text,
  ADD COLUMN provider_reference text UNIQUE,
  ADD COLUMN client_key uuid UNIQUE,
  ADD COLUMN error text,
  ADD COLUMN claimed_at timestamptz,
  ADD COLUMN sent_at timestamptz;
CREATE INDEX sms_messages_event_idx ON public.sms_messages(event_id, created_at DESC);
CREATE INDEX sms_messages_pending_idx ON public.sms_messages(created_at) WHERE status = 'pending';

-- Recipient-level results. `status` is the delivery status shown in history.
ALTER TABLE public.sms_recipients
  ADD COLUMN to_number text,
  ADD COLUMN submission_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN provider_sms_id text,
  ADD COLUMN error text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX sms_recipients_message_idx ON public.sms_recipients(message_id, to_number);

-- Tall Bob webhook events, stored once each (duplicates ignored).
CREATE TABLE public.sms_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id text NOT NULL UNIQUE,
  credential_id uuid,
  event_type text,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.sms_webhook_events FROM anon, authenticated;
GRANT ALL ON public.sms_webhook_events TO service_role;
ALTER TABLE public.sms_webhook_events ENABLE ROW LEVEL SECURITY;

-- All sends now go through the send-sms function, which checks scope and the event's account.
DROP POLICY IF EXISTS "send sms" ON public.sms_messages;
DROP POLICY IF EXISTS "add sms recipients" ON public.sms_recipients;
REVOKE INSERT, UPDATE, DELETE ON public.sms_messages FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.sms_recipients FROM anon, authenticated;
GRANT ALL ON public.sms_messages, public.sms_recipients TO service_role;

-- Event staff and the sending provider can see per-recipient results in history.
CREATE POLICY "staff read sms recipients" ON public.sms_recipients FOR SELECT TO authenticated
  USING (public.is_event_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.sms_messages m
     WHERE m.id = sms_recipients.message_id AND m.contractor_id IS NOT NULL
       AND public.is_contractor_member(auth.uid(), m.contractor_id)));

-- Automatic alerts carry their event (from the variation) so the right account is used.
CREATE OR REPLACE FUNCTION public.sms_message_fill_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.event_id IS NULL AND NEW.variation_id IS NOT NULL THEN
    SELECT event_id INTO NEW.event_id FROM public.variations WHERE id = NEW.variation_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sms_message_fill_event BEFORE INSERT ON public.sms_messages
  FOR EACH ROW EXECUTE FUNCTION public.sms_message_fill_event();

-- Dispatcher claims queued automatic messages; stale ones are failed rather than sent late.
CREATE OR REPLACE FUNCTION public.claim_sms_messages(_limit integer DEFAULT 20)
RETURNS SETOF uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.sms_messages SET status = 'failed', error = 'Not sent: it waited more than an hour'
   WHERE status = 'pending' AND created_at < now() - interval '1 hour';
  RETURN QUERY
  UPDATE public.sms_messages m SET status = 'sending', claimed_at = now()
   WHERE m.id IN (SELECT id FROM public.sms_messages WHERE status = 'pending'
                   ORDER BY created_at LIMIT LEAST(GREATEST(_limit, 1), 100) FOR UPDATE SKIP LOCKED)
  RETURNING m.id;
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_sms_messages(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_sms_messages(integer) TO service_role;

-- Wake-on-enqueue: ping the input-less sms-dispatch function when queued messages exist.
CREATE OR REPLACE FUNCTION public.wake_sms_dispatch()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sms_messages WHERE status = 'pending') THEN RETURN; END IF;
  PERFORM net.http_post(
    url := public.edge_function_url('sms-dispatch'),
    headers := public.edge_function_headers(),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
EXCEPTION WHEN others THEN RAISE WARNING 'sms dispatch wake failed: %', SQLERRM;
END $$;
REVOKE EXECUTE ON FUNCTION public.wake_sms_dispatch() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sms_recipients_wake_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.wake_sms_dispatch(); RETURN NULL; END $$;
CREATE TRIGGER sms_recipients_wake AFTER INSERT ON public.sms_recipients
  FOR EACH STATEMENT EXECUTE FUNCTION public.sms_recipients_wake_trigger();

-- Automatic alerts are now queued for sending ('pending') instead of 'not_sent'.
CREATE OR REPLACE FUNCTION public.alert_guards_on_roster_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE s public.roster_slots; v public.variations; msg_id uuid; body text; n integer; tz text;
BEGIN
  IF NEW.variation_id IS NULL OR NEW.slot_id IS NULL OR NEW.change_type NOT IN ('time','redeploy') THEN RETURN NEW; END IF;
  SELECT count(*) INTO n FROM public.attendance WHERE slot_id = NEW.slot_id AND signed_off_at IS NULL;
  IF n = 0 THEN RETURN NEW; END IF;
  SELECT * INTO s FROM public.roster_slots WHERE id = NEW.slot_id;
  SELECT * INTO v FROM public.variations WHERE id = NEW.variation_id;
  SELECT COALESCE(timezone, 'Australia/Sydney') INTO tz FROM public.events WHERE id = s.event_id;
  IF NEW.change_type = 'time' THEN
    body := 'Hi {name}, your shift has changed (' || v.ref || '). New time: '
      || to_char(s.current_start AT TIME ZONE tz, 'HH24:MI') || '–' || to_char(s.current_end AT TIME ZONE tz, 'HH24:MI')
      || '. Your automatic sign-off is now ' || to_char(s.current_end AT TIME ZONE tz, 'HH24:MI') || '.';
  ELSIF s.temp_redeploy IS NOT NULL AND s.temp_redeploy->>'variation_ref' = v.ref THEN
    body := 'Hi {name}, you are redeployed (' || v.ref || ') to ' || COALESCE(s.temp_redeploy->>'position','') || ' (' || COALESCE(s.temp_redeploy->>'zone','') || ') until '
      || to_char((s.temp_redeploy->>'until')::timestamptz AT TIME ZONE tz, 'HH24:MI') || ', then return to your original post.';
  ELSE
    body := 'Hi {name}, you are redeployed (' || v.ref || ') to ' || s.position || ' (' || s.zone || '). Please report there now.';
  END IF;
  INSERT INTO public.sms_messages (body, audience_label, recipient_count, status, contractor_id, variation_id, event_id, sent_by_user, sent_by_name)
  VALUES (body, 'Automatic alert: ' || v.ref || ' · ' || s.position, n, 'pending', s.contractor_id, v.id, s.event_id, NEW.actor_user_id, 'Automatic alert')
  RETURNING id INTO msg_id;
  INSERT INTO public.sms_recipients (message_id, guard_id, phone)
  SELECT msg_id, a.guard_id, g.phone FROM public.attendance a JOIN public.guards g ON g.id = a.guard_id
  WHERE a.slot_id = NEW.slot_id AND a.signed_off_at IS NULL;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.queue_variation_staff_alert(_kind text, _key uuid, _contractor_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE lead public.variations; n integer; cname text; tlabel text; link text; body text; msg_id uuid; cnt integer; byname text;
BEGIN
  SELECT * INTO lead FROM public.variations
   WHERE COALESCE(group_id, id) = _key AND (_kind <> 'ack' OR contractor_id IS NOT DISTINCT FROM _contractor_id)
   ORDER BY created_at, ref LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT count(*) INTO n FROM public.variations
   WHERE COALESCE(group_id, id) = _key AND (_kind <> 'ack' OR contractor_id IS NOT DISTINCT FROM _contractor_id);
  SELECT name INTO cname FROM public.contractors WHERE id = COALESCE(_contractor_id, lead.contractor_id);
  tlabel := CASE lead.variation_type WHEN 'time' THEN 'time change' WHEN 'redeploy' THEN 'redeployment' WHEN 'additional' THEN 'additional guards' ELSE lead.variation_type END;
  link := 'https://security.outthereadmin.com.au/admin/variations?open=' || lead.id;
  IF _kind = 'ack' THEN
    byname := 'Requested by ' || lead.requested_by_name;
    body := 'Variation ' || lead.ref || ' needs your acknowledgement: ' || n || CASE WHEN n = 1 THEN ' shift, ' ELSE ' shifts, ' END
      || tlabel || COALESCE(' for ' || cname, '') || ', requested by ' || lead.requested_by_name || '. Review: ' || link;
  ELSE
    byname := CASE WHEN lead.ack_by_name IS NOT NULL THEN 'Acknowledged by ' || lead.ack_by_name ELSE 'Requested by ' || lead.requested_by_name END;
    body := 'Variation ' || lead.ref || ' is ready for your approval: ' || n || CASE WHEN n = 1 THEN ' shift, ' ELSE ' shifts, ' END
      || tlabel || COALESCE(' for ' || cname, '')
      || CASE WHEN lead.ack_by_name IS NOT NULL THEN ', acknowledged by ' || lead.ack_by_name ELSE ', requested by ' || lead.requested_by_name END
      || '. Review: ' || link;
  END IF;
  SELECT count(*) INTO cnt FROM public.variation_alert_recipients(_kind, _contractor_id, auth.uid());
  IF cnt = 0 THEN RETURN; END IF;
  INSERT INTO public.sms_messages (body, audience_label, recipient_count, status, contractor_id, variation_id, event_id, sent_by_user, sent_by_name)
  VALUES (body, 'Automatic alert: ' || lead.ref || CASE WHEN _kind = 'ack' THEN ' · acknowledgement needed' ELSE ' · approval needed' END,
          cnt, 'pending', CASE WHEN _kind = 'ack' THEN _contractor_id END, lead.id, lead.event_id, auth.uid(), 'Automatic alert')
  RETURNING id INTO msg_id;
  INSERT INTO public.sms_recipients (message_id, guard_id, phone)
  SELECT msg_id, NULL, r.phone FROM public.variation_alert_recipients(_kind, _contractor_id, auth.uid()) r;
  INSERT INTO public.staff_email_alerts (kind, variation_id, sms_message_id, user_id, full_name, email, ref, shift_count, type_label, contractor_name, by_name, link)
  SELECT _kind, lead.id, msg_id, r.user_id, r.full_name, lower(trim(r.email)), lead.ref, n, tlabel, cname, byname, link
    FROM public.variation_alert_recipients(_kind, _contractor_id, auth.uid()) r
   WHERE r.email IS NOT NULL AND trim(r.email) <> '';
END $function$;