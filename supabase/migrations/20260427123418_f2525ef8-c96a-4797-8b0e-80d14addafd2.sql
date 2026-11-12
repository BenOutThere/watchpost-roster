CREATE TYPE public.scope_change_status AS ENUM ('draft', 'submitted', 'pending_leadership_signoff', 'approved', 'rejected', 'completed');

CREATE TABLE public.event_scope_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  scope_detail TEXT NOT NULL,
  operational_reason TEXT NOT NULL,
  requested_by_user_id UUID,
  requested_by_name TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  required_from TIMESTAMPTZ,
  required_until TIMESTAMPTZ,
  additional_guards INTEGER NOT NULL DEFAULT 0,
  additional_supervisors INTEGER NOT NULL DEFAULT 0,
  equipment_required TEXT,
  cost_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'GBP',
  client_reference TEXT,
  status public.scope_change_status NOT NULL DEFAULT 'draft',
  senior_leader_name TEXT,
  senior_leader_role TEXT,
  signoff_notes TEXT,
  signed_off_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_event_scope_changes_updated_at BEFORE UPDATE ON public.event_scope_changes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.event_scope_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage event scope changes" ON public.event_scope_changes FOR ALL TO authenticated USING (public.is_admin_role(auth.uid())) WITH CHECK (public.is_admin_role(auth.uid()));
CREATE POLICY "Guards view own shift scope changes" ON public.event_scope_changes FOR SELECT TO authenticated USING (shift_id IS NOT NULL AND public.guard_owns_shift(shift_id));

CREATE INDEX idx_event_scope_changes_status ON public.event_scope_changes(status);
CREATE INDEX idx_event_scope_changes_site ON public.event_scope_changes(site_id);
CREATE INDEX idx_event_scope_changes_requested_at ON public.event_scope_changes(requested_at DESC);

ALTER TABLE public.event_scope_changes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_scope_changes;