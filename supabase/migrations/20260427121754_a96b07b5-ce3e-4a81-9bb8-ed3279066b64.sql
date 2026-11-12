REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_role(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_owns_guard(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_owns_shift(UUID) FROM authenticated;