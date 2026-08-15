-- TitanOS 2.0 / 5000X: trigger functions are internal-only.
-- They must remain callable by their attached triggers but must not be exposed
-- as public/authenticated RPC capabilities.

REVOKE EXECUTE ON FUNCTION public.protect_payment_authority() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_core_tenant_ownership() FROM PUBLIC, anon, authenticated;
