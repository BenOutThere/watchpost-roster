CREATE OR REPLACE FUNCTION public.can_view_costs(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'super_admin') OR public.has_role(_user_id, 'operations_manager');
$$;
GRANT EXECUTE ON FUNCTION public.can_view_costs(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_roster_manager(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_role(_user_id) OR public.has_role(_user_id, 'event_manager') OR public.has_role(_user_id, 'security_manager');
$$;

CREATE TABLE public.roster_slot_costs (
  slot_id uuid PRIMARY KEY REFERENCES public.roster_slots(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  hourly_rate numeric(12,4) NOT NULL DEFAULT 0,
  paid_hours numeric(10,4),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roster_slot_costs TO authenticated;
GRANT ALL ON public.roster_slot_costs TO service_role;
ALTER TABLE public.roster_slot_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage slot costs" ON public.roster_slot_costs FOR ALL TO authenticated
  USING (public.can_view_costs(auth.uid())) WITH CHECK (public.can_view_costs(auth.uid()));
CREATE INDEX roster_slot_costs_event_idx ON public.roster_slot_costs(event_id);
CREATE TRIGGER roster_slot_costs_updated_at BEFORE UPDATE ON public.roster_slot_costs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.variation_costs (
  variation_id uuid PRIMARY KEY REFERENCES public.variations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  hourly_rate numeric(12,4) NOT NULL DEFAULT 0,
  original_hours numeric(10,4) NOT NULL DEFAULT 0,
  proposed_hours numeric(10,4) NOT NULL DEFAULT 0,
  original_cost numeric(12,2) NOT NULL DEFAULT 0,
  proposed_cost numeric(12,2) NOT NULL DEFAULT 0,
  cost_delta numeric(12,2) GENERATED ALWAYS AS (proposed_cost - original_cost) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.variation_costs TO authenticated;
GRANT ALL ON public.variation_costs TO service_role;
ALTER TABLE public.variation_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage variation costs" ON public.variation_costs FOR ALL TO authenticated
  USING (public.can_view_costs(auth.uid())) WITH CHECK (public.can_view_costs(auth.uid()));
CREATE INDEX variation_costs_event_idx ON public.variation_costs(event_id);

-- Price every new variation server-side so requests from non-admins are costed too.
CREATE OR REPLACE FUNCTION public.variation_compute_cost()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.roster_slots; c public.roster_slot_costs;
  rate numeric := 0; cur_h numeric; orig_h numeric; paid numeric; new_h numeric; n integer;
BEGIN
  IF NEW.variation_type IN ('time', 'redeploy') AND NEW.slot_id IS NOT NULL THEN
    SELECT * INTO s FROM public.roster_slots WHERE id = NEW.slot_id;
    SELECT * INTO c FROM public.roster_slot_costs WHERE slot_id = NEW.slot_id;
    rate := COALESCE(c.hourly_rate, 0);
    cur_h := extract(epoch FROM (s.current_end - s.current_start)) / 3600;
    orig_h := extract(epoch FROM (COALESCE(s.original_end, s.current_end) - COALESCE(s.original_start, s.current_start))) / 3600;
    paid := COALESCE(c.paid_hours, orig_h) + (cur_h - orig_h);
    IF NEW.variation_type = 'time' AND (NEW.proposed->>'start') IS NOT NULL AND (NEW.proposed->>'end') IS NOT NULL THEN
      new_h := extract(epoch FROM ((NEW.proposed->>'end')::timestamptz - (NEW.proposed->>'start')::timestamptz)) / 3600;
    ELSE
      new_h := cur_h;
    END IF;
    INSERT INTO public.variation_costs (variation_id, event_id, hourly_rate, original_hours, proposed_hours, original_cost, proposed_cost)
    VALUES (NEW.id, NEW.event_id, rate, paid, paid + (new_h - cur_h), round(paid * rate, 2), round((paid + new_h - cur_h) * rate, 2));
  ELSIF NEW.variation_type = 'additional' THEN
    n := GREATEST(1, COALESCE((NEW.proposed->>'count')::int, 1));
    new_h := extract(epoch FROM ((NEW.proposed->>'end')::timestamptz - (NEW.proposed->>'start')::timestamptz)) / 3600;
    SELECT rc.hourly_rate INTO rate FROM public.roster_slot_costs rc JOIN public.roster_slots rs ON rs.id = rc.slot_id
      WHERE rs.event_id = NEW.event_id AND lower(trim(rs.role)) = lower(trim(COALESCE(NEW.proposed->>'role', '')))
      GROUP BY rc.hourly_rate ORDER BY count(*) DESC LIMIT 1;
    IF rate IS NULL THEN
      SELECT rc.hourly_rate INTO rate FROM public.roster_slot_costs rc WHERE rc.event_id = NEW.event_id
        GROUP BY rc.hourly_rate ORDER BY count(*) DESC LIMIT 1;
    END IF;
    rate := COALESCE(rate, 0);
    INSERT INTO public.variation_costs (variation_id, event_id, hourly_rate, original_hours, proposed_hours, original_cost, proposed_cost)
    VALUES (NEW.id, NEW.event_id, rate, 0, n * new_h, 0, round(n * new_h * rate, 2));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER variations_compute_cost AFTER INSERT ON public.variations FOR EACH ROW EXECUTE FUNCTION public.variation_compute_cost();

-- Positions created by an approved "add guards" variation inherit its rate.
CREATE OR REPLACE FUNCTION public.roster_slot_cost_from_variation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.source_variation_id IS NOT NULL AND NEW.is_additional THEN
    INSERT INTO public.roster_slot_costs (slot_id, event_id, hourly_rate, paid_hours)
    SELECT NEW.id, NEW.event_id, vc.hourly_rate, extract(epoch FROM (NEW.current_end - NEW.current_start)) / 3600
    FROM public.variation_costs vc WHERE vc.variation_id = NEW.source_variation_id
    ON CONFLICT (slot_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER roster_slots_cost_from_variation AFTER INSERT ON public.roster_slots FOR EACH ROW EXECUTE FUNCTION public.roster_slot_cost_from_variation();