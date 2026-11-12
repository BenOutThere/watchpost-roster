CREATE TABLE public.role_permissions (
  role public.app_role NOT NULL,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed-in users read access per user type" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "super admin manages access per user type" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.role_permissions (role, permission) VALUES
  ('senior_management','view_dashboard'),('senior_management','view_roster'),('senior_management','view_costs'),('senior_management','view_variations'),('senior_management','view_guards'),('senior_management','view_communications'),('senior_management','request_variations'),('senior_management','approve_variations'),
  ('event_manager','view_dashboard'),('event_manager','view_roster'),('event_manager','view_variations'),('event_manager','view_guards'),('event_manager','view_sign_in'),('event_manager','view_communications'),('event_manager','view_settings'),('event_manager','request_variations'),
  ('event_control_assistant','view_dashboard'),('event_control_assistant','view_roster'),('event_control_assistant','view_variations'),('event_control_assistant','view_guards'),
  ('security_manager','view_dashboard'),('security_manager','view_roster'),('security_manager','view_variations'),('security_manager','view_guards'),('security_manager','view_sign_in'),('security_manager','view_communications'),('security_manager','request_variations'),('security_manager','acknowledge_variations'),('security_manager','sign_on_guards'),
  ('security_zone_manager','view_dashboard'),('security_zone_manager','view_roster'),('security_zone_manager','view_variations'),('security_zone_manager','view_guards'),('security_zone_manager','request_variations'),
  ('security_sign_in','view_sign_in'),('security_sign_in','sign_on_guards')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role(_user_id, 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.user_id = _user_id AND rp.permission = _permission
    );
$function$;

COMMENT ON TABLE public.user_permissions IS 'DEPRECATED: access is now set per user type in role_permissions';