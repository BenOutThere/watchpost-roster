REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_role(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guard_owns_guard(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guard_owns_shift(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_owns_guard(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_owns_shift(UUID) TO authenticated;