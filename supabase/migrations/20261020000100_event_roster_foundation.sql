
CREATE OR REPLACE FUNCTION public.is_roster_manager(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_role(_user_id) OR public.has_role(_user_id, 'event_manager');
$$;

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  venue text NOT NULL DEFAULT '',
  timezone text NOT NULL DEFAULT 'Australia/Sydney',
  event_date date,
  gps_required boolean NOT NULL DEFAULT false,
  venue_lat double precision,
  venue_lng double precision,
  venue_radius_m integer NOT NULL DEFAULT 500,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  contact_name text,
  phone text,
  email text,
  gps_required boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.contractor_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contractor_id, user_id)
);

ALTER TABLE public.guards ADD COLUMN IF NOT EXISTS contractor_id uuid REFERENCES public.contractors(id);

CREATE OR REPLACE FUNCTION public.is_contractor_member(_user_id uuid, _contractor_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.contractor_members WHERE user_id = _user_id AND contractor_id = _contractor_id);
$$;
CREATE OR REPLACE FUNCTION public.can_access_contractor(_contractor_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_roster_manager(auth.uid()) OR public.is_contractor_member(auth.uid(), _contractor_id);
$$;

CREATE TABLE public.roster_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  version integer NOT NULL,
  kind text NOT NULL DEFAULT 'current',
  label text NOT NULL,
  source_file_name text,
  variation_id uuid,
  slot_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, version)
);

CREATE TABLE public.roster_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  contractor_id uuid REFERENCES public.contractors(id),
  shift_ref text NOT NULL,
  role text NOT NULL DEFAULT '',
  position text NOT NULL DEFAULT '',
  zone text NOT NULL DEFAULT '',
  scope text NOT NULL DEFAULT '',
  notes text,
  current_start timestamptz NOT NULL,
  current_end timestamptz NOT NULL,
  original_start timestamptz,
  original_end timestamptz,
  original_role text,
  original_position text,
  original_zone text,
  original_scope text,
  original_contractor_id uuid,
  required boolean NOT NULL DEFAULT true,
  is_additional boolean NOT NULL DEFAULT false,
  assigned_guard_id uuid REFERENCES public.guards(id),
  assigned_guard_name text,
  temp_redeploy jsonb,
  status text NOT NULL DEFAULT 'active',
  version integer NOT NULL DEFAULT 1,
  source_variation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, shift_ref)
);
CREATE INDEX roster_slots_event_time ON public.roster_slots (event_id, current_start, current_end);

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  guard_id uuid NOT NULL REFERENCES public.guards(id),
  slot_id uuid REFERENCES public.roster_slots(id),
  signed_on_at timestamptz NOT NULL DEFAULT now(),
  signed_off_at timestamptz,
  sign_on_method text NOT NULL DEFAULT 'mobile',
  sign_off_method text,
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  gps_override_by uuid,
  signed_on_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX attendance_one_active_per_guard ON public.attendance (guard_id) WHERE signed_off_at IS NULL;
CREATE UNIQUE INDEX attendance_one_active_per_slot ON public.attendance (slot_id) WHERE signed_off_at IS NULL AND slot_id IS NOT NULL;

CREATE TABLE public.variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text NOT NULL UNIQUE DEFAULT ('VAR-' || lpad((floor(random()*1000000))::text, 6, '0')),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  contractor_id uuid REFERENCES public.contractors(id),
  variation_type text NOT NULL CHECK (variation_type IN ('time','redeploy','additional')),
  slot_id uuid REFERENCES public.roster_slots(id),
  original jsonb NOT NULL DEFAULT '{}'::jsonb,
  proposed jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL,
  notes text,
  requested_by_user uuid,
  requested_by_name text NOT NULL,
  status text NOT NULL DEFAULT 'awaiting_ack' CHECK (status IN ('requested','awaiting_ack','awaiting_approval','approved','declined','returned')),
  ack_by_user uuid,
  ack_by_name text,
  ack_at timestamptz,
  ack_comments text,
  approved_by_user uuid,
  approved_by_name text,
  approved_at timestamptz,
  decision_notes text,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.roster_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  slot_id uuid REFERENCES public.roster_slots(id),
  variation_id uuid REFERENCES public.variations(id),
  change_type text NOT NULL,
  summary text NOT NULL,
  before jsonb,
  after jsonb,
  actor_user_id uuid,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.guard_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  contractor_id uuid REFERENCES public.contractors(id),
  kind text NOT NULL DEFAULT 'manual',
  filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.guard_group_members (
  group_id uuid NOT NULL REFERENCES public.guard_groups(id) ON DELETE CASCADE,
  guard_id uuid NOT NULL REFERENCES public.guards(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, guard_id)
);

CREATE TABLE public.sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body text NOT NULL,
  audience_label text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'not_sent',
  contractor_id uuid REFERENCES public.contractors(id),
  variation_id uuid REFERENCES public.variations(id),
  sent_by_user uuid,
  sent_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.sms_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.sms_messages(id) ON DELETE CASCADE,
  guard_id uuid REFERENCES public.guards(id),
  phone text,
  status text NOT NULL DEFAULT 'not_sent'
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events, public.contractors, public.contractor_members, public.roster_versions, public.roster_slots, public.attendance, public.variations, public.guard_groups, public.guard_group_members, public.sms_messages, public.sms_recipients TO authenticated;
GRANT SELECT, INSERT ON public.roster_change_log TO authenticated;
GRANT ALL ON public.events, public.contractors, public.contractor_members, public.roster_versions, public.roster_slots, public.attendance, public.variations, public.roster_change_log, public.guard_groups, public.guard_group_members, public.sms_messages, public.sms_recipients TO service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guard_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guard_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_recipients ENABLE ROW LEVEL SECURITY;

-- events / contractors: any signed-in user reads; managers write
CREATE POLICY "read events" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage events" ON public.events FOR ALL TO authenticated USING (public.is_roster_manager(auth.uid())) WITH CHECK (public.is_roster_manager(auth.uid()));
CREATE POLICY "read contractors" ON public.contractors FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage contractors" ON public.contractors FOR ALL TO authenticated USING (public.is_roster_manager(auth.uid())) WITH CHECK (public.is_roster_manager(auth.uid()));
CREATE POLICY "read own membership" ON public.contractor_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_roster_manager(auth.uid()));
CREATE POLICY "manage memberships" ON public.contractor_members FOR ALL TO authenticated USING (public.is_roster_manager(auth.uid())) WITH CHECK (public.is_roster_manager(auth.uid()));

CREATE POLICY "read versions" ON public.roster_versions FOR SELECT TO authenticated USING (public.is_roster_manager(auth.uid()) OR EXISTS (SELECT 1 FROM public.contractor_members m WHERE m.user_id = auth.uid()));
CREATE POLICY "manage versions" ON public.roster_versions FOR INSERT TO authenticated WITH CHECK (public.is_roster_manager(auth.uid()));

CREATE POLICY "read slots" ON public.roster_slots FOR SELECT TO authenticated USING (public.can_access_contractor(contractor_id) OR public.guard_owns_guard(assigned_guard_id));
CREATE POLICY "manage slots" ON public.roster_slots FOR ALL TO authenticated USING (public.is_roster_manager(auth.uid())) WITH CHECK (public.is_roster_manager(auth.uid()));

CREATE POLICY "read attendance" ON public.attendance FOR SELECT TO authenticated USING (public.is_roster_manager(auth.uid()) OR public.guard_owns_guard(guard_id) OR EXISTS (SELECT 1 FROM public.guards g WHERE g.id = guard_id AND public.is_contractor_member(auth.uid(), g.contractor_id)));

CREATE POLICY "read variations" ON public.variations FOR SELECT TO authenticated USING (public.can_access_contractor(contractor_id));
CREATE POLICY "request variations" ON public.variations FOR INSERT TO authenticated WITH CHECK (public.can_access_contractor(contractor_id) AND status = 'awaiting_ack' AND applied_at IS NULL);

CREATE POLICY "read change log" ON public.roster_change_log FOR SELECT TO authenticated USING (public.is_roster_manager(auth.uid()) OR EXISTS (SELECT 1 FROM public.roster_slots s WHERE s.id = slot_id AND public.can_access_contractor(s.contractor_id)));

CREATE POLICY "read groups" ON public.guard_groups FOR SELECT TO authenticated USING (public.is_roster_manager(auth.uid()) OR (contractor_id IS NOT NULL AND public.is_contractor_member(auth.uid(), contractor_id)));
CREATE POLICY "write groups" ON public.guard_groups FOR ALL TO authenticated USING (public.is_roster_manager(auth.uid()) OR (contractor_id IS NOT NULL AND public.is_contractor_member(auth.uid(), contractor_id))) WITH CHECK (public.is_roster_manager(auth.uid()) OR (contractor_id IS NOT NULL AND public.is_contractor_member(auth.uid(), contractor_id)));
CREATE POLICY "group members" ON public.guard_group_members FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.guard_groups gg WHERE gg.id = group_id AND (public.is_roster_manager(auth.uid()) OR (gg.contractor_id IS NOT NULL AND public.is_contractor_member(auth.uid(), gg.contractor_id))))) WITH CHECK (EXISTS (SELECT 1 FROM public.guard_groups gg WHERE gg.id = group_id AND (public.is_roster_manager(auth.uid()) OR (gg.contractor_id IS NOT NULL AND public.is_contractor_member(auth.uid(), gg.contractor_id)))));

CREATE POLICY "read sms" ON public.sms_messages FOR SELECT TO authenticated USING (public.is_roster_manager(auth.uid()) OR (contractor_id IS NOT NULL AND public.is_contractor_member(auth.uid(), contractor_id)) OR EXISTS (SELECT 1 FROM public.sms_recipients r WHERE r.message_id = id AND public.guard_owns_guard(r.guard_id)));
CREATE POLICY "send sms" ON public.sms_messages FOR INSERT TO authenticated WITH CHECK (sent_by_user = auth.uid() AND (public.is_roster_manager(auth.uid()) OR (contractor_id IS NOT NULL AND public.is_contractor_member(auth.uid(), contractor_id))));
CREATE POLICY "read sms recipients" ON public.sms_recipients FOR SELECT TO authenticated USING (public.guard_owns_guard(guard_id) OR EXISTS (SELECT 1 FROM public.sms_messages m WHERE m.id = message_id AND m.sent_by_user = auth.uid()) OR public.is_roster_manager(auth.uid()));
CREATE POLICY "add sms recipients" ON public.sms_recipients FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.sms_messages m WHERE m.id = message_id AND m.sent_by_user = auth.uid()));

-- guards readable by contractor managers for their own contractor
CREATE POLICY "contractor reads own guards" ON public.guards FOR SELECT TO authenticated USING (contractor_id IS NOT NULL AND public.is_contractor_member(auth.uid(), contractor_id));

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contractors_updated_at BEFORE UPDATE ON public.contractors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_roster_slots_updated_at BEFORE UPDATE ON public.roster_slots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_variations_updated_at BEFORE UPDATE ON public.variations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Preserve originals automatically on insert
CREATE OR REPLACE FUNCTION public.roster_slot_set_original() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.original_start := COALESCE(NEW.original_start, NEW.current_start);
  NEW.original_end := COALESCE(NEW.original_end, NEW.current_end);
  NEW.original_role := COALESCE(NEW.original_role, NEW.role);
  NEW.original_position := COALESCE(NEW.original_position, NEW.position);
  NEW.original_zone := COALESCE(NEW.original_zone, NEW.zone);
  NEW.original_scope := COALESCE(NEW.original_scope, NEW.scope);
  NEW.original_contractor_id := COALESCE(NEW.original_contractor_id, NEW.contractor_id);
  RETURN NEW;
END $$;
CREATE TRIGGER roster_slot_original BEFORE INSERT ON public.roster_slots FOR EACH ROW EXECUTE FUNCTION public.roster_slot_set_original();

-- Originals can never be changed
CREATE OR REPLACE FUNCTION public.roster_slot_protect_original() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.original_start := OLD.original_start; NEW.original_end := OLD.original_end;
  NEW.original_role := OLD.original_role; NEW.original_position := OLD.original_position;
  NEW.original_zone := OLD.original_zone; NEW.original_scope := OLD.original_scope;
  NEW.original_contractor_id := OLD.original_contractor_id;
  RETURN NEW;
END $$;
CREATE TRIGGER roster_slot_protect BEFORE UPDATE ON public.roster_slots FOR EACH ROW EXECUTE FUNCTION public.roster_slot_protect_original();

ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.roster_slots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.variations;
