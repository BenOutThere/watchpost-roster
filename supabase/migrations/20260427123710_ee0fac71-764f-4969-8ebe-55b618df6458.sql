CREATE TYPE public.shift_extension_status AS ENUM ('requested', 'approved', 'rejected', 'expired');

CREATE TABLE public.shift_extensions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  guard_id UUID NOT NULL REFERENCES public.guards(id) ON DELETE CASCADE,
  requested_by_user_id UUID NOT NULL,
  requested_until TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  estimated_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.shift_extension_status NOT NULL DEFAULT 'requested',
  approved_by_user_id UUID,
  approved_by_name TEXT,
  approved_at TIMESTAMPTZ,
  decision_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.auto_complete_due_shifts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  completed_count INTEGER;
BEGIN
  WITH due_shifts AS (
    SELECT s.id, s.guard_id
    FROM public.shifts s
    WHERE s.status = 'active'
      AND s.end_time <= now()
      AND NOT EXISTS (
        SELECT 1
        FROM public.shift_extensions e
        WHERE e.shift_id = s.id
          AND e.status = 'approved'
          AND e.requested_until > now()
      )
  ), updated AS (
    UPDATE public.shifts s
    SET status = 'completed',
        logged_off_at = COALESCE(s.logged_off_at, now()),
        end_shift_notes = COALESCE(s.end_shift_notes, 'Automatically ended at rostered finish time because no approved extension was active.'),
        updated_at = now()
    FROM due_shifts d
    WHERE s.id = d.id
    RETURNING s.id, s.guard_id
  ), audit AS (
    INSERT INTO public.audit_logs (guard_id, shift_id, event_type, event_details)
    SELECT guard_id, id, 'automatic_shift_end', jsonb_build_object('reason', 'Rostered finish reached without approved extension', 'ended_at', now())
    FROM updated
    RETURNING id
  )
  SELECT count(*) INTO completed_count FROM updated;

  RETURN completed_count;
END;
$$;

CREATE TRIGGER update_shift_extensions_updated_at BEFORE UPDATE ON public.shift_extensions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.shift_extensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage shift extensions" ON public.shift_extensions FOR ALL TO authenticated USING (public.is_admin_role(auth.uid())) WITH CHECK (public.is_admin_role(auth.uid()));
CREATE POLICY "Guards create own shift extensions" ON public.shift_extensions FOR INSERT TO authenticated WITH CHECK (public.guard_owns_guard(guard_id) AND public.guard_owns_shift(shift_id) AND requested_by_user_id = auth.uid());
CREATE POLICY "Guards view own shift extensions" ON public.shift_extensions FOR SELECT TO authenticated USING (public.guard_owns_guard(guard_id));

CREATE INDEX idx_shift_extensions_shift_status ON public.shift_extensions(shift_id, status);
CREATE INDEX idx_shift_extensions_guard ON public.shift_extensions(guard_id);
CREATE INDEX idx_shift_extensions_requested_until ON public.shift_extensions(requested_until);

ALTER TABLE public.shift_extensions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_extensions;

REVOKE EXECUTE ON FUNCTION public.auto_complete_due_shifts() FROM PUBLIC, anon, authenticated;