CREATE TYPE public.planned_position_status AS ENUM ('planned', 'filled', 'unfilled', 'inactive');
CREATE TYPE public.plan_file_status AS ENUM ('uploaded', 'processing', 'processed', 'failed');

CREATE TABLE public.position_plan_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  status public.plan_file_status NOT NULL DEFAULT 'uploaded',
  uploaded_by_user_id UUID NOT NULL,
  extracted_positions_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.planned_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  plan_file_id UUID REFERENCES public.position_plan_files(id) ON DELETE SET NULL,
  assigned_guard_id UUID REFERENCES public.guards(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  zone TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 45,
  required_from TIMESTAMPTZ,
  required_until TIMESTAMPTZ,
  status public.planned_position_status NOT NULL DEFAULT 'planned',
  source_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_position_plan_files_updated_at BEFORE UPDATE ON public.position_plan_files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_planned_positions_updated_at BEFORE UPDATE ON public.planned_positions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.position_plan_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planned_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage position plan files" ON public.position_plan_files FOR ALL TO authenticated USING (public.is_admin_role(auth.uid())) WITH CHECK (public.is_admin_role(auth.uid()));
CREATE POLICY "Admins manage planned positions" ON public.planned_positions FOR ALL TO authenticated USING (public.is_admin_role(auth.uid())) WITH CHECK (public.is_admin_role(auth.uid()));
CREATE POLICY "Guards view assigned planned positions" ON public.planned_positions FOR SELECT TO authenticated USING (assigned_guard_id IS NOT NULL AND public.guard_owns_guard(assigned_guard_id));

INSERT INTO storage.buckets (id, name, public) VALUES ('position-plans', 'position-plans', false);

CREATE POLICY "Admins access position plan files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'position-plans' AND public.is_admin_role(auth.uid()));
CREATE POLICY "Admins upload position plan files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'position-plans' AND public.is_admin_role(auth.uid()));
CREATE POLICY "Admins update position plan files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'position-plans' AND public.is_admin_role(auth.uid())) WITH CHECK (bucket_id = 'position-plans' AND public.is_admin_role(auth.uid()));

CREATE INDEX idx_planned_positions_site_status ON public.planned_positions(site_id, status);
CREATE INDEX idx_planned_positions_guard ON public.planned_positions(assigned_guard_id);
CREATE INDEX idx_position_plan_files_site ON public.position_plan_files(site_id);

ALTER TABLE public.planned_positions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.planned_positions;