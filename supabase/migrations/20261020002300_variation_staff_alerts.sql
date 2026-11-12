-- Staff mobile numbers: set by the person, a Super Admin, or a provider user manager for their own provider's users.
CREATE OR REPLACE FUNCTION public.set_user_mobile(_user_id uuid, _phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p text := NULLIF(btrim(COALESCE(_phone, '')), '');
BEGIN
  IF NOT (auth.uid() = _user_id OR public.has_role(auth.uid(), 'super_admin')
          OR (public.has_permission(auth.uid(), 'add_provider_users') AND public.shares_contractor(auth.uid(), _user_id))) THEN
    RAISE EXCEPTION 'You can''t change this person''s mobile number';
  END IF;
  IF p IS NOT NULL AND (length(p) > 20 OR p !~ '^\+?[0-9 ()-]{8,20}$') THEN
    RAISE EXCEPTION 'Enter a valid mobile number, e.g. 0412 345 678';
  END IF;
  UPDATE public.profiles SET phone = p, updated_at = now() WHERE user_id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_user_mobile(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_mobile(uuid, text) TO authenticated;

-- Who should hear about a variation: acknowledgers of one provider ('ack') or everyone who can approve ('approve').
CREATE OR REPLACE FUNCTION public.variation_alert_recipients(_kind text, _contractor_id uuid, _exclude uuid)
RETURNS TABLE(user_id uuid, full_name text, email text, phone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT p.user_id, p.full_name, p.email, p.phone
  FROM public.user_roles ur
  JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.user_id IS DISTINCT FROM _exclude
    AND CASE _kind
      WHEN 'ack' THEN _contractor_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.role_permissions rp WHERE rp.role = ur.role AND rp.permission = 'acknowledge_variations')
        AND EXISTS (SELECT 1 FROM public.contractor_members cm WHERE cm.user_id = ur.user_id AND cm.contractor_id = _contractor_id)
      WHEN 'approve' THEN ur.role = 'super_admin'
        OR EXISTS (SELECT 1 FROM public.role_permissions rp WHERE rp.role = ur.role AND rp.permission = 'approve_variations')
      ELSE false END
$$;
REVOKE ALL ON FUNCTION public.variation_alert_recipients(text, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Queue one text for a request (_key = group_id, or id for single-shift requests).
CREATE OR REPLACE FUNCTION public.queue_variation_staff_alert(_kind text, _key uuid, _contractor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lead public.variations; n integer; cname text; tlabel text; link text; body text; msg_id uuid; cnt integer;
BEGIN
  SELECT * INTO lead FROM public.variations
   WHERE COALESCE(group_id, id) = _key AND (_kind <> 'ack' OR contractor_id IS NOT DISTINCT FROM _contractor_id)
   ORDER BY created_at, ref LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT count(*) INTO n FROM public.variations
   WHERE COALESCE(group_id, id) = _key AND (_kind <> 'ack' OR contractor_id IS NOT DISTINCT FROM _contractor_id);
  SELECT name INTO cname FROM public.contractors WHERE id = COALESCE(_contractor_id, lead.contractor_id);
  tlabel := CASE lead.variation_type WHEN 'time' THEN 'time change' WHEN 'redeploy' THEN 'redeployment' WHEN 'additional' THEN 'additional guards' ELSE lead.variation_type END;
  link := 'https://security.outthereadmin.com.au/admin/variations?open=' || lead.id;
  IF _kind = 'ack' THEN
    body := 'Variation ' || lead.ref || ' needs your acknowledgement: ' || n || CASE WHEN n = 1 THEN ' shift, ' ELSE ' shifts, ' END
      || tlabel || COALESCE(' for ' || cname, '') || ', requested by ' || lead.requested_by_name || '. Review: ' || link;
  ELSE
    body := 'Variation ' || lead.ref || ' is ready for your approval: ' || n || CASE WHEN n = 1 THEN ' shift, ' ELSE ' shifts, ' END
      || tlabel || COALESCE(' for ' || cname, '')
      || CASE WHEN lead.ack_by_name IS NOT NULL THEN ', acknowledged by ' || lead.ack_by_name ELSE ', requested by ' || lead.requested_by_name END
      || '. Review: ' || link;
  END IF;
  SELECT count(*) INTO cnt FROM public.variation_alert_recipients(_kind, _contractor_id, auth.uid());
  IF cnt = 0 THEN RETURN; END IF;
  INSERT INTO public.sms_messages (body, audience_label, recipient_count, status, contractor_id, variation_id, sent_by_user, sent_by_name)
  VALUES (body, 'Automatic alert: ' || lead.ref || CASE WHEN _kind = 'ack' THEN ' · acknowledgement needed' ELSE ' · approval needed' END,
          cnt, 'not_sent', CASE WHEN _kind = 'ack' THEN _contractor_id END, lead.id, auth.uid(), 'Automatic alert')
  RETURNING id INTO msg_id;
  INSERT INTO public.sms_recipients (message_id, guard_id, phone)
  SELECT msg_id, NULL, r.phone FROM public.variation_alert_recipients(_kind, _contractor_id, auth.uid()) r;
END $$;
REVOKE ALL ON FUNCTION public.queue_variation_staff_alert(text, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- New request: text that provider's acknowledgers; if the provider has nobody who can acknowledge, text approvers instead.
CREATE OR REPLACE FUNCTION public.variations_alert_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; approved_keys uuid[] := '{}';
BEGIN
  BEGIN
    FOR r IN SELECT DISTINCT COALESCE(group_id, id) AS k, contractor_id AS c FROM new_rows WHERE status IN ('awaiting_ack', 'requested') LOOP
      IF EXISTS (SELECT 1 FROM public.variation_alert_recipients('ack', r.c, NULL)) THEN
        PERFORM public.queue_variation_staff_alert('ack', r.k, r.c);
      ELSIF NOT r.k = ANY(approved_keys) THEN
        PERFORM public.queue_variation_staff_alert('approve', r.k, NULL);
        approved_keys := approved_keys || r.k;
      END IF;
    END LOOP;
  EXCEPTION WHEN others THEN RAISE WARNING 'variation alert failed: %', SQLERRM;
  END;
  RETURN NULL;
END $$;

-- Acknowledged: once no shift in the request is still waiting for acknowledgement, text the approvers.
CREATE OR REPLACE FUNCTION public.variations_alert_on_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  BEGIN
    FOR r IN SELECT DISTINCT COALESCE(n.group_id, n.id) AS k FROM new_rows n JOIN old_rows o ON o.id = n.id
             WHERE n.status = 'awaiting_approval' AND o.status IS DISTINCT FROM 'awaiting_approval' LOOP
      IF NOT EXISTS (SELECT 1 FROM public.variations WHERE COALESCE(group_id, id) = r.k AND status IN ('awaiting_ack', 'requested', 'returned')) THEN
        PERFORM public.queue_variation_staff_alert('approve', r.k, NULL);
      END IF;
    END LOOP;
  EXCEPTION WHEN others THEN RAISE WARNING 'variation alert failed: %', SQLERRM;
  END;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS variations_alert_insert ON public.variations;
CREATE TRIGGER variations_alert_insert AFTER INSERT ON public.variations
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.variations_alert_on_insert();
DROP TRIGGER IF EXISTS variations_alert_update ON public.variations;
CREATE TRIGGER variations_alert_update AFTER UPDATE ON public.variations
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.variations_alert_on_update();