CREATE TYPE public.app_role AS ENUM ('super_admin', 'operations_manager', 'site_supervisor', 'security_guard');
CREATE TYPE public.guard_status AS ENUM ('active', 'suspended', 'pending');
CREATE TYPE public.shift_status AS ENUM ('scheduled', 'briefing', 'active', 'completed', 'missed');
CREATE TYPE public.location_status AS ENUM ('in_zone', 'moving', 'outside_zone', 'offline');
CREATE TYPE public.incident_status AS ENUM ('draft', 'submitted', 'reviewed', 'closed');
CREATE TYPE public.incident_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.alert_status AS ENUM ('open', 'acknowledged', 'resolved');
CREATE TYPE public.alert_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE public.invite_status AS ENUM ('unused', 'used', 'expired');

CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.sites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  geo_fence_coordinates JSONB NOT NULL DEFAULT '[]'::jsonb,
  map_reference TEXT,
  supervisor_name TEXT NOT NULL,
  supervisor_phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.guards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  employee_id TEXT NOT NULL UNIQUE,
  licence_number TEXT NOT NULL,
  profile_photo TEXT,
  emergency_contact TEXT NOT NULL,
  status public.guard_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guard_id UUID NOT NULL REFERENCES public.guards(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  zone TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  briefing TEXT NOT NULL,
  key_instructions TEXT,
  emergency_procedures TEXT,
  notes TEXT,
  status public.shift_status NOT NULL DEFAULT 'scheduled',
  logged_on_at TIMESTAMPTZ,
  logged_off_at TIMESTAMPTZ,
  log_on_location JSONB,
  log_off_location JSONB,
  briefing_acknowledged_at TIMESTAMPTZ,
  end_shift_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.location_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guard_id UUID NOT NULL REFERENCES public.guards(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  status public.location_status NOT NULL DEFAULT 'in_zone',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guard_id UUID NOT NULL REFERENCES public.guards(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  incident_type TEXT NOT NULL,
  severity public.incident_severity NOT NULL DEFAULT 'medium',
  description TEXT NOT NULL,
  persons_involved TEXT,
  action_taken TEXT,
  witness_notes TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  media_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  admin_notes TEXT,
  status public.incident_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guard_id UUID REFERENCES public.guards(id) ON DELETE SET NULL,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity public.alert_severity NOT NULL DEFAULT 'warning',
  status public.alert_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id UUID,
  guard_id UUID REFERENCES public.guards(id) ON DELETE SET NULL,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.onboarding_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invite_code TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL DEFAULT 'Sentinel Security Group',
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  event_name TEXT,
  assigned_role TEXT,
  status public.invite_status NOT NULL DEFAULT 'unused',
  used_by_user_id UUID,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.incident_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_role(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin')
    OR public.has_role(_user_id, 'operations_manager')
    OR public.has_role(_user_id, 'site_supervisor');
$$;

CREATE OR REPLACE FUNCTION public.guard_owns_guard(_guard_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guards
    WHERE id = _guard_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.guard_owns_shift(_shift_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shifts s
    JOIN public.guards g ON g.id = s.guard_id
    WHERE s.id = _shift_id AND g.user_id = auth.uid()
  );
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON public.sites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_guards_updated_at BEFORE UPDATE ON public.guards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON public.alerts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_onboarding_invites_updated_at BEFORE UPDATE ON public.onboarding_invites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin_role(auth.uid()));

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Super admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins manage sites" ON public.sites FOR ALL TO authenticated USING (public.is_admin_role(auth.uid())) WITH CHECK (public.is_admin_role(auth.uid()));
CREATE POLICY "Guards view assigned sites" ON public.sites FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.shifts s JOIN public.guards g ON g.id = s.guard_id WHERE s.site_id = sites.id AND g.user_id = auth.uid()));

CREATE POLICY "Admins manage guards" ON public.guards FOR ALL TO authenticated USING (public.is_admin_role(auth.uid())) WITH CHECK (public.is_admin_role(auth.uid()));
CREATE POLICY "Guards manage own record" ON public.guards FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage shifts" ON public.shifts FOR ALL TO authenticated USING (public.is_admin_role(auth.uid())) WITH CHECK (public.is_admin_role(auth.uid()));
CREATE POLICY "Guards view own shifts" ON public.shifts FOR SELECT TO authenticated USING (public.guard_owns_guard(guard_id));
CREATE POLICY "Guards update own shift activity" ON public.shifts FOR UPDATE TO authenticated USING (public.guard_owns_guard(guard_id)) WITH CHECK (public.guard_owns_guard(guard_id));

CREATE POLICY "Admins manage location updates" ON public.location_updates FOR ALL TO authenticated USING (public.is_admin_role(auth.uid())) WITH CHECK (public.is_admin_role(auth.uid()));
CREATE POLICY "Guards create own active location updates" ON public.location_updates FOR INSERT TO authenticated WITH CHECK (public.guard_owns_guard(guard_id) AND public.guard_owns_shift(shift_id) AND EXISTS (SELECT 1 FROM public.shifts s WHERE s.id = shift_id AND s.status = 'active'));
CREATE POLICY "Guards view own location updates" ON public.location_updates FOR SELECT TO authenticated USING (public.guard_owns_guard(guard_id));

CREATE POLICY "Admins manage incidents" ON public.incidents FOR ALL TO authenticated USING (public.is_admin_role(auth.uid())) WITH CHECK (public.is_admin_role(auth.uid()));
CREATE POLICY "Guards manage own incidents" ON public.incidents FOR ALL TO authenticated USING (public.guard_owns_guard(guard_id)) WITH CHECK (public.guard_owns_guard(guard_id) AND public.guard_owns_shift(shift_id));

CREATE POLICY "Admins manage alerts" ON public.alerts FOR ALL TO authenticated USING (public.is_admin_role(auth.uid())) WITH CHECK (public.is_admin_role(auth.uid()));
CREATE POLICY "Guards view own alerts" ON public.alerts FOR SELECT TO authenticated USING (guard_id IS NOT NULL AND public.guard_owns_guard(guard_id));

CREATE POLICY "Admins view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin_role(auth.uid()));
CREATE POLICY "Authenticated create audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (actor_user_id = auth.uid() OR public.is_admin_role(auth.uid()));

CREATE POLICY "Anyone can view unused invite by code" ON public.onboarding_invites FOR SELECT TO anon, authenticated USING (status = 'unused' AND (expires_at IS NULL OR expires_at > now()));
CREATE POLICY "Admins manage invites" ON public.onboarding_invites FOR ALL TO authenticated USING (public.is_admin_role(auth.uid())) WITH CHECK (public.is_admin_role(auth.uid()));
CREATE POLICY "Users mark own invite used" ON public.onboarding_invites FOR UPDATE TO authenticated USING (status = 'unused') WITH CHECK (used_by_user_id = auth.uid());

CREATE POLICY "Admins manage incident media" ON public.incident_media FOR ALL TO authenticated USING (public.is_admin_role(auth.uid())) WITH CHECK (public.is_admin_role(auth.uid()));
CREATE POLICY "Guards manage own incident media" ON public.incident_media FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.incidents i WHERE i.id = incident_id AND public.guard_owns_guard(i.guard_id))) WITH CHECK (uploaded_by_user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.incidents i WHERE i.id = incident_id AND public.guard_owns_guard(i.guard_id)));

INSERT INTO storage.buckets (id, name, public) VALUES ('guard-photos', 'guard-photos', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('incident-media', 'incident-media', false);

CREATE POLICY "Users access own guard photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'guard-photos' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin_role(auth.uid())));
CREATE POLICY "Users upload own guard photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'guard-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own guard photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'guard-photos' AND auth.uid()::text = (storage.foldername(name))[1]) WITH CHECK (bucket_id = 'guard-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users access incident media" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'incident-media' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin_role(auth.uid())));
CREATE POLICY "Users upload incident media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'incident-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update incident media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'incident-media' AND auth.uid()::text = (storage.foldername(name))[1]) WITH CHECK (bucket_id = 'incident-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE INDEX idx_guards_user_id ON public.guards(user_id);
CREATE INDEX idx_shifts_guard_id ON public.shifts(guard_id);
CREATE INDEX idx_shifts_site_id ON public.shifts(site_id);
CREATE INDEX idx_location_updates_shift_time ON public.location_updates(shift_id, timestamp DESC);
CREATE INDEX idx_incidents_status_severity ON public.incidents(status, severity);
CREATE INDEX idx_alerts_status_created ON public.alerts(status, created_at DESC);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

ALTER TABLE public.location_updates REPLICA IDENTITY FULL;
ALTER TABLE public.incidents REPLICA IDENTITY FULL;
ALTER TABLE public.alerts REPLICA IDENTITY FULL;
ALTER TABLE public.shifts REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.location_updates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts;