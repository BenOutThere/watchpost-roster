-- Automatic sign-off runs every 5 minutes (it also completes due shifts, closes expired
-- location sessions and rolls the demo roster forward). In the Lovable project this job
-- was scheduled outside the migrations, so a fresh project needs it here.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-sign-off-due') THEN
    PERFORM cron.unschedule('auto-sign-off-due');
  END IF;
  PERFORM cron.schedule('auto-sign-off-due', '*/5 * * * *', 'select public.auto_sign_off_due();');
END $$;
