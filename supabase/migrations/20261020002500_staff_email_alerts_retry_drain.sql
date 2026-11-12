-- lovable-cron-fallback-reviewed: no new schedule; the wake function now unschedules the retry job itself once nothing is waiting.
CREATE OR REPLACE FUNCTION public.wake_staff_email_alerts()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff_email_alerts WHERE status IN ('pending', 'sending') AND created_at > now() - interval '24 hours') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'retry-staff-email-alerts') THEN
      PERFORM cron.unschedule('retry-staff-email-alerts');
    END IF;
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := public.edge_function_url('send-staff-alerts'),
    headers := public.edge_function_headers(),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
EXCEPTION WHEN others THEN RAISE WARNING 'email alert wake failed: %', SQLERRM;
END $$;
REVOKE ALL ON FUNCTION public.wake_staff_email_alerts() FROM PUBLIC, anon, authenticated;