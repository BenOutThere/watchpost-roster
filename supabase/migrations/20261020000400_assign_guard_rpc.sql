DROP POLICY IF EXISTS "contractor assigns own slots" ON public.roster_slots;
CREATE OR REPLACE FUNCTION public.assign_guard_to_slot(_slot_id uuid, _guard_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.roster_slots; g public.guards;
BEGIN
  SELECT * INTO s FROM public.roster_slots WHERE id = _slot_id FOR UPDATE;
  IF NOT public.can_access_contractor(s.contractor_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF _guard_id IS NOT NULL THEN
    SELECT * INTO g FROM public.guards WHERE id = _guard_id;
    IF EXISTS (SELECT 1 FROM public.roster_slots o WHERE o.assigned_guard_id = _guard_id AND o.id <> s.id AND o.status = 'active' AND o.current_start < s.current_end AND s.current_start < o.current_end) THEN
      RAISE EXCEPTION '% is already rostered to an overlapping position', g.name;
    END IF;
  END IF;
  UPDATE public.roster_slots SET assigned_guard_id = _guard_id, assigned_guard_name = g.name WHERE id = _slot_id;
  INSERT INTO public.roster_change_log (event_id, slot_id, change_type, summary, before, after, actor_user_id, actor_name)
  VALUES (s.event_id, s.id, 'assignment', COALESCE(g.name, 'No guard') || ' assigned (replacing ' || COALESCE(s.assigned_guard_name, 'nobody') || ')', jsonb_build_object('guard', s.assigned_guard_name), jsonb_build_object('guard', g.name), auth.uid(), public.actor_name());
END $$;
REVOKE EXECUTE ON FUNCTION public.assign_guard_to_slot(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_guard_to_slot(uuid, uuid) TO authenticated;