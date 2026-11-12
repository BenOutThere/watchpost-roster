CREATE OR REPLACE FUNCTION public.guard_on_slot(_slot_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.attendance a JOIN public.guards g ON g.id = a.guard_id
    WHERE a.slot_id = _slot_id AND g.user_id = auth.uid()
  )
$$;
REVOKE ALL ON FUNCTION public.guard_on_slot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_on_slot(uuid) TO authenticated;

CREATE POLICY "guard reads slot signed on to" ON public.roster_slots
  FOR SELECT TO authenticated USING (public.guard_on_slot(id));
CREATE POLICY "guard reads changes to slot signed on to" ON public.roster_change_log
  FOR SELECT TO authenticated USING (public.guard_on_slot(slot_id));