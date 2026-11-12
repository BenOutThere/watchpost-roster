ALTER TABLE public.variations ADD COLUMN IF NOT EXISTS group_id uuid;
COMMENT ON COLUMN public.variations.group_id IS 'Shared by every shift submitted together in one multi-shift variation request (one row per shift).';
CREATE INDEX IF NOT EXISTS variations_group_id_idx ON public.variations (group_id) WHERE group_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.approve_variation_group(_group_id uuid, _notes text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0;
BEGIN
  IF NOT public.can_approve_variations(auth.uid()) THEN RAISE EXCEPTION 'Only Admins and Event Managers can approve variations'; END IF;
  FOR r IN SELECT id FROM public.variations WHERE group_id = _group_id AND status = 'awaiting_approval' AND applied_at IS NULL ORDER BY created_at, ref FOR UPDATE LOOP
    PERFORM public.approve_variation(r.id, _notes);
    n := n + 1;
  END LOOP;
  IF n = 0 THEN RAISE EXCEPTION 'No shifts in this request are awaiting approval'; END IF;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.acknowledge_variation_group(_group_id uuid, _comments text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT id, contractor_id FROM public.variations WHERE group_id = _group_id AND status IN ('awaiting_ack','requested','returned') ORDER BY created_at, ref FOR UPDATE LOOP
    IF public.can_access_contractor(r.contractor_id) THEN
      PERFORM public.acknowledge_variation(r.id, _comments);
      n := n + 1;
    END IF;
  END LOOP;
  IF n = 0 THEN RAISE EXCEPTION 'No shifts in this request are waiting for your acknowledgement'; END IF;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.decide_variation_group(_group_id uuid, _decision text, _notes text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0;
BEGIN
  IF NOT public.is_roster_manager(auth.uid()) THEN RAISE EXCEPTION 'Only event managers can decline or return variations'; END IF;
  FOR r IN SELECT id FROM public.variations WHERE group_id = _group_id AND status IN ('awaiting_ack','requested','awaiting_approval','returned') AND applied_at IS NULL ORDER BY created_at, ref FOR UPDATE LOOP
    PERFORM public.decide_variation(r.id, _decision, _notes);
    n := n + 1;
  END LOOP;
  IF n = 0 THEN RAISE EXCEPTION 'No shifts in this request are still pending'; END IF;
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION public.approve_variation_group(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.acknowledge_variation_group(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decide_variation_group(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_variation_group(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_variation_group(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_variation_group(uuid, text, text) TO authenticated;