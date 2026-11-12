CREATE TABLE IF NOT EXISTS public.event_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID,
  event_name TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  client_name TEXT,
  client_contact TEXT,
  supervisor_name TEXT NOT NULL,
  supervisor_phone TEXT NOT NULL,
  briefing TEXT NOT NULL,
  entry_instructions TEXT,
  emergency_procedures TEXT NOT NULL,
  expected_attendance INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.event_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage event details" ON public.event_details;
CREATE POLICY "Admins manage event details"
ON public.event_details
FOR ALL
TO authenticated
USING (public.is_admin_role(auth.uid()))
WITH CHECK (public.is_admin_role(auth.uid()));

DROP POLICY IF EXISTS "Guards view assigned event details" ON public.event_details;
CREATE POLICY "Guards view assigned event details"
ON public.event_details
FOR SELECT
TO authenticated
USING (
  site_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.shifts s
    JOIN public.guards g ON g.id = s.guard_id
    WHERE s.site_id = event_details.site_id
      AND g.user_id = auth.uid()
  )
);

DROP TRIGGER IF EXISTS update_event_details_updated_at ON public.event_details;
CREATE TRIGGER update_event_details_updated_at
BEFORE UPDATE ON public.event_details
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Users create own security guard role" ON public.user_roles;
CREATE POLICY "Users create own security guard role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'security_guard'::public.app_role);

CREATE INDEX IF NOT EXISTS idx_event_details_site_id ON public.event_details(site_id);
CREATE INDEX IF NOT EXISTS idx_event_details_start_time ON public.event_details(start_time);