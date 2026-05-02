-- Restrict direct RPC access to SECURITY DEFINER functions flagged by Supabase Advisor.
-- These functions stay SECURITY DEFINER where required, but normal API roles must not
-- be able to call them directly through /rest/v1/rpc/*.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.check_is_admin()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.create_order_with_payment(
  text,
  text,
  jsonb,
  jsonb,
  text,
  integer
) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_admin_notification()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_order_with_payment(
  text,
  text,
  jsonb,
  jsonb,
  text,
  integer
) TO service_role;

COMMIT;
