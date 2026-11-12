DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.approve_variation(uuid,text)'::regprocedure);
  d := replace(d, $q$IF v.status <> 'awaiting_approval' THEN RAISE EXCEPTION 'Contractor acknowledgement is required before approval'; END IF;$q$,
                  $q$IF v.status NOT IN ('awaiting_ack','requested','returned','awaiting_approval') THEN RAISE EXCEPTION 'Variation is not pending'; END IF;$q$);
  EXECUTE d;
END $$;

CREATE OR REPLACE FUNCTION public.approve_variation_group(_group_id uuid, _notes text DEFAULT NULL::text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record; n integer := 0;
BEGIN
  IF NOT public.can_approve_variations(auth.uid()) THEN RAISE EXCEPTION 'You do not have permission to approve variations'; END IF;
  FOR r IN SELECT id FROM public.variations WHERE group_id = _group_id AND status IN ('awaiting_ack','requested','returned','awaiting_approval') AND applied_at IS NULL ORDER BY created_at, ref FOR UPDATE LOOP
    PERFORM public.approve_variation(r.id, _notes);
    n := n + 1;
  END LOOP;
  IF n = 0 THEN RAISE EXCEPTION 'No shifts in this request are pending'; END IF;
  RETURN n;
END $function$;