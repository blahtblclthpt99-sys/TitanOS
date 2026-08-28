-- TitanOS recovery compatibility migration.
--
-- The authoritative Supabase ledger proves these no-argument functions existed
-- before 20260814020146_harden_internal_security_definer_rpcs, because that
-- migration revokes EXECUTE on their exact signatures. No ledgered migration or
-- surviving Git history contains their original bodies or trigger attachments.
--
-- Recovery policy: preserve the proven function identities so the historical
-- security migration replays unchanged, but do NOT invent trigger attachments
-- or hidden data mutations that cannot be demonstrated from surviving evidence.
-- The application explicitly manages active_company_id, and customer deletion
-- retains job/invoice history without database cascades.

BEGIN;

CREATE OR REPLACE FUNCTION public.assign_active_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Compatibility-only reconstruction. Original automatic behavior is not
  -- recoverable with sufficient confidence; intentionally do not mutate state.
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.detach_deleted_customer_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Compatibility-only reconstruction. Core customer references are non-FK
  -- text fields, so deleting a contact does not cascade-delete business history.
  -- No unproven cleanup behavior is invented here.
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.assign_active_company_id() IS
  'Recovery compatibility signature for an unledgered pre-20260814020146 internal trigger function; no trigger attachment is reconstructed.';
COMMENT ON FUNCTION public.detach_deleted_customer_references() IS
  'Recovery compatibility signature for an unledgered pre-20260814020146 internal trigger function; no trigger attachment is reconstructed.';

COMMIT;
