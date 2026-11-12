-- lovable-cron-fallback-reviewed: retry job is armed only while undelivered alert emails exist (e.g. sender domain still verifying) and is unscheduled by the sender once drained; delivery itself is wake-on-enqueue.
CREATE TABLE public.staff_email_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  variation_id uuid,
  sms_message_id uuid,
  user_id uuid,
  full_name text,
  email text NOT NULL,
  ref text,
  shift_count integer NOT NULL DEFAULT 1,
  type_label text,
  contractor_name text,
  by_name text,
  link text,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.staff_email_alerts TO authenticated;
GRANT ALL ON public.staff_email_alerts TO service_role;
ALTER TABLE public.staff_email_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super Admin reads staff email alerts" ON public.staff_email_alerts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE INDEX staff_email_alerts_pending_idx ON public.staff_email_alerts (created_at) WHERE status IN ('pending', 'sending');

-- Hands out work to the sender function: pending rows plus rows stuck "sending" for 10+ minutes.
-- Alerts older than a day are no longer useful and are expired instead of sent.
CREATE OR REPLACE FUNCTION public.claim_staff_email_alerts(_limit integer DEFAULT 50)
RETURNS SETOF public.staff_email_alerts
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.staff_email_alerts SET status = 'expired'
   WHERE status IN ('pending', 'sending') AND created_at < now() - interval '24 hours';
  RETURN QUERY
  UPDATE public.staff_email_alerts a SET status = 'sending', claimed_at = now(), attempts = a.attempts + 1
   WHERE a.id IN (
     SELECT id FROM public.staff_email_alerts
      WHERE status = 'pending' OR (status = 'sending' AND claimed_at < now() - interval '10 minutes')
      ORDER BY created_at LIMIT LEAST(GREATEST(_limit, 1), 200)
      FOR UPDATE SKIP LOCKED)
  RETURNING a.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_staff_email_alerts(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_staff_email_alerts(integer) TO service_role;

-- Nudges the sender function. Never blocks the change that queued the alert.
CREATE OR REPLACE FUNCTION public.wake_staff_email_alerts()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff_email_alerts WHERE status IN ('pending', 'sending') AND created_at > now() - interval '24 hours') THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := public.edge_function_url('send-staff-alerts'),
    headers := public.edge_function_headers(),
    body := '{}'::jsonb);
EXCEPTION WHEN others THEN RAISE WARNING 'email alert wake failed: %', SQLERRM;
END $$;
REVOKE ALL ON FUNCTION public.wake_staff_email_alerts() FROM PUBLIC, anon, authenticated;

-- Called by the sender after each run: keeps a retry job only while undelivered alerts remain.
CREATE OR REPLACE FUNCTION public.sync_staff_email_retry()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE waiting boolean; armed boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.staff_email_alerts WHERE status IN ('pending', 'sending') AND created_at > now() - interval '24 hours') INTO waiting;
  SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'retry-staff-email-alerts') INTO armed;
  IF waiting AND NOT armed THEN
    PERFORM cron.schedule('retry-staff-email-alerts', '*/15 * * * *', 'select public.wake_staff_email_alerts();');
  ELSIF NOT waiting AND armed THEN
    PERFORM cron.unschedule('retry-staff-email-alerts');
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.sync_staff_email_retry() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_staff_email_retry() TO service_role;

CREATE OR REPLACE FUNCTION public.staff_email_alerts_wake_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN PERFORM public.wake_staff_email_alerts(); RETURN NULL; END $$;
CREATE TRIGGER staff_email_alerts_wake AFTER INSERT ON public.staff_email_alerts
  FOR EACH STATEMENT EXECUTE FUNCTION public.staff_email_alerts_wake_trigger();

-- Same alert rule as the texts; now also queues one email per recipient with an email address.
CREATE OR REPLACE FUNCTION public.queue_variation_staff_alert(_kind text, _key uuid, _contractor_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  INSERT INTO public.sms_messages (body, audience_label, recipient_count, status, contractor_id, variation_id, sent_by_user, sent_by_name)
  VALUES (body, 'Automatic alert: ' || lead.ref || CASE WHEN _kind = 'ack' THEN ' · acknowledgement needed' ELSE ' · approval needed' END,
          cnt, 'not_sent', CASE WHEN _kind = 'ack' THEN _contractor_id END, lead.id, auth.uid(), 'Automatic alert')
  RETURNING id INTO msg_id;
  INSERT INTO public.sms_recipients (message_id, guard_id, phone)
  SELECT msg_id, NULL, r.phone FROM public.variation_alert_recipients(_kind, _contractor_id, auth.uid()) r;
  INSERT INTO public.staff_email_alerts (kind, variation_id, sms_message_id, user_id, full_name, email, ref, shift_count, type_label, contractor_name, by_name, link)
  SELECT _kind, lead.id, msg_id, r.user_id, r.full_name, lower(trim(r.email)), lead.ref, n, tlabel, cname, byname, link
    FROM public.variation_alert_recipients(_kind, _contractor_id, auth.uid()) r
   WHERE r.email IS NOT NULL AND trim(r.email) <> '';
END $function$;