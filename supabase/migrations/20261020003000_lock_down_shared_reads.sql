-- Access settings: people read only their own user type's ticks; managers read all (read-only table in Settings).
DROP POLICY IF EXISTS "signed-in users read access per user type" ON public.role_permissions;
CREATE POLICY "read own user type access, managers read all" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (
    public.is_roster_manager(auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = role_permissions.role)
  );

-- Security providers: event staff see all; provider staff see their own; guards see their own provider or the provider of the shift they're signed on to.
CREATE OR REPLACE FUNCTION public.can_read_contractor(_contractor_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_access_contractor(_contractor_id)
    OR EXISTS (SELECT 1 FROM public.guards g WHERE g.user_id = auth.uid() AND g.contractor_id = _contractor_id)
    OR EXISTS (
      SELECT 1 FROM public.attendance a
      JOIN public.guards g ON g.id = a.guard_id
      JOIN public.roster_slots rs ON rs.id = a.slot_id
      WHERE g.user_id = auth.uid() AND a.signed_off_at IS NULL AND rs.contractor_id = _contractor_id
    );
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_contractor(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_read_contractor(uuid) TO authenticated;

DROP POLICY IF EXISTS "read contractors" ON public.contractors;
CREATE POLICY "read contractors you work with" ON public.contractors
  FOR SELECT TO authenticated
  USING (public.can_read_contractor(id));

-- Location sharing settings: event staff, provider staff working the event, and guards signed on at the event.
CREATE OR REPLACE FUNCTION public.can_read_event_location_settings(_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_event_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.contractor_members cm
      JOIN public.roster_slots rs ON rs.contractor_id = cm.contractor_id
      WHERE cm.user_id = auth.uid() AND rs.event_id = _event_id
    )
    OR EXISTS (
      SELECT 1 FROM public.attendance a
      JOIN public.guards g ON g.id = a.guard_id
      LEFT JOIN public.roster_slots rs ON rs.id = a.slot_id
      WHERE g.user_id = auth.uid() AND a.signed_off_at IS NULL
        AND coalesce(a.event_id, rs.event_id) = _event_id
    );
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_event_location_settings(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_read_event_location_settings(uuid) TO authenticated;

DROP POLICY IF EXISTS "signed-in read location settings" ON public.event_location_settings;
CREATE POLICY "read location settings for your events" ON public.event_location_settings
  FOR SELECT TO authenticated
  USING (public.can_read_event_location_settings(event_id));
