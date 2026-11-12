DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'roster_upload_status') THEN
    CREATE TYPE public.roster_upload_status AS ENUM ('uploaded', 'processing', 'processed', 'failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'roster_variation_status') THEN
    CREATE TYPE public.roster_variation_status AS ENUM ('draft', 'pending_signoff', 'approved', 'rejected');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.security_roster_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  uploaded_by_user_id UUID NOT NULL,
  status public.roster_upload_status NOT NULL DEFAULT 'uploaded',
  imported_rows INTEGER NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS roster_upload_id UUID NULL,
  ADD COLUMN IF NOT EXISTS roster_row_reference TEXT NULL,
  ADD COLUMN IF NOT EXISTS roster_location TEXT NULL,
  ADD COLUMN IF NOT EXISTS roster_cost NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS roster_currency TEXT NOT NULL DEFAULT 'GBP',
  ADD COLUMN IF NOT EXISTS roster_hourly_rate NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS roster_planned_hours NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS roster_variation_status public.roster_variation_status NOT NULL DEFAULT 'approved';

CREATE INDEX IF NOT EXISTS idx_shifts_roster_upload_id ON public.shifts(roster_upload_id);
CREATE INDEX IF NOT EXISTS idx_shifts_roster_variation_status ON public.shifts(roster_variation_status);

ALTER TABLE public.security_roster_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage security roster uploads" ON public.security_roster_uploads;
CREATE POLICY "Admins manage security roster uploads"
ON public.security_roster_uploads
FOR ALL
TO authenticated
USING (public.is_admin_role(auth.uid()))
WITH CHECK (public.is_admin_role(auth.uid()) AND uploaded_by_user_id = auth.uid());

DROP POLICY IF EXISTS "Guards view own roster uploads" ON public.security_roster_uploads;
CREATE POLICY "Guards view own roster uploads"
ON public.security_roster_uploads
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.shifts s
    JOIN public.guards g ON g.id = s.guard_id
    WHERE s.roster_upload_id = security_roster_uploads.id
      AND g.user_id = auth.uid()
  )
);

CREATE TABLE IF NOT EXISTS public.roster_variations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID NOT NULL,
  guard_id UUID NOT NULL,
  roster_upload_id UUID NULL,
  requested_by_user_id UUID NOT NULL,
  variation_reason TEXT NOT NULL,
  original_start_time TIMESTAMP WITH TIME ZONE NULL,
  original_end_time TIMESTAMP WITH TIME ZONE NULL,
  original_location TEXT NULL,
  original_cost NUMERIC NULL,
  proposed_start_time TIMESTAMP WITH TIME ZONE NULL,
  proposed_end_time TIMESTAMP WITH TIME ZONE NULL,
  proposed_location TEXT NULL,
  proposed_cost NUMERIC NULL,
  cost_delta NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'GBP',
  status public.roster_variation_status NOT NULL DEFAULT 'pending_signoff',
  approver_user_id UUID NULL,
  approver_name TEXT NULL,
  approver_role TEXT NULL,
  signoff_notes TEXT NULL,
  signed_off_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.roster_variations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage roster variations" ON public.roster_variations;
CREATE POLICY "Admins manage roster variations"
ON public.roster_variations
FOR ALL
TO authenticated
USING (public.is_admin_role(auth.uid()))
WITH CHECK (public.is_admin_role(auth.uid()));

DROP POLICY IF EXISTS "Guards view own roster variations" ON public.roster_variations;
CREATE POLICY "Guards view own roster variations"
ON public.roster_variations
FOR SELECT
TO authenticated
USING (public.guard_owns_guard(guard_id) AND public.guard_owns_shift(shift_id));

CREATE INDEX IF NOT EXISTS idx_roster_variations_shift_id ON public.roster_variations(shift_id);
CREATE INDEX IF NOT EXISTS idx_roster_variations_guard_id ON public.roster_variations(guard_id);
CREATE INDEX IF NOT EXISTS idx_roster_variations_status ON public.roster_variations(status);

DROP TRIGGER IF EXISTS update_security_roster_uploads_updated_at ON public.security_roster_uploads;
CREATE TRIGGER update_security_roster_uploads_updated_at
BEFORE UPDATE ON public.security_roster_uploads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_roster_variations_updated_at ON public.roster_variations;
CREATE TRIGGER update_roster_variations_updated_at
BEFORE UPDATE ON public.roster_variations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('security-rosters', 'security-rosters', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins manage security roster files" ON storage.objects;
CREATE POLICY "Admins manage security roster files"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'security-rosters' AND public.is_admin_role(auth.uid()))
WITH CHECK (bucket_id = 'security-rosters' AND public.is_admin_role(auth.uid()));