CREATE OR REPLACE FUNCTION public.shares_contractor(_viewer uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contractor_members a
    JOIN public.contractor_members b ON b.contractor_id = a.contractor_id
    WHERE a.user_id = _viewer AND b.user_id = _user
  );
$$;

CREATE POLICY "provider user managers view provider profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'add_provider_users') AND public.shares_contractor(auth.uid(), user_id));

CREATE POLICY "provider user managers view provider roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'add_provider_users') AND public.shares_contractor(auth.uid(), user_id));

CREATE POLICY "provider user managers view provider memberships" ON public.contractor_members
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'add_provider_users') AND public.is_contractor_member(auth.uid(), contractor_id));