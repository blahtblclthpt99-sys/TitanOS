-- Resolve production security-advisor findings without changing public workflows.
-- Token-based contract RPCs and is_admin() intentionally remain callable because
-- public contract signing and RLS policies depend on them.

ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.titan_comms_prevent_admin_transfer() SET search_path = public;

-- Founding slots are assigned by trusted triggers/server operations only.
REVOKE ALL ON FUNCTION public.claim_founding_slot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_founding_slot(uuid) TO service_role;

-- Trigger functions must not be exposed as client RPC endpoints.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.profiles_auto_claim_founding() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_driver_id_verified() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_escrow_settlement() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_invoice_paid_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_message_body() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_privileges() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_referral_paying_flags() FROM PUBLIC, anon, authenticated;

