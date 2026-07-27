-- 038: $0.99 Marketplace Modules pack unlock (all catalog apps).
-- Also included with Pro/Business; this flag is for Free/Starter buyers of the pack.
-- Not a membership plan — do not map $0.99 to plan_tier.
-- Source of truth: supabase/migrations/038_marketplace_pack_unlocked.sql

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketplace_pack_unlocked BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.marketplace_pack_unlocked IS
  'True after $0.99 Marketplace Modules PayPal pack payment (all catalog modules).';

UPDATE public.marketplace_modules
SET
  price = 0.99,
  price_label = '$0.99 · all modules'
WHERE true;

CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin() THEN
    NEW.role := OLD.role;
    NEW.is_pro := OLD.is_pro;
    NEW.lifetime_premium := OLD.lifetime_premium;
    IF OLD.paying_subscriber IS NOT NULL THEN
      NEW.paying_subscriber := OLD.paying_subscriber;
    END IF;
    NEW.plan_tier := OLD.plan_tier;
    NEW.verified_worker := OLD.verified_worker;
    NEW.verification_notes := OLD.verification_notes;
    IF OLD.account_type IS NOT NULL AND btrim(OLD.account_type) <> '' THEN
      NEW.account_type := OLD.account_type;
    END IF;
    NEW.founding_user := OLD.founding_user;
    NEW.founding_number := OLD.founding_number;
    NEW.founding_trial_ends_at := OLD.founding_trial_ends_at;
    NEW.founding_price_lock := OLD.founding_price_lock;
    NEW.founding_locked_plan := OLD.founding_locked_plan;
    NEW.marketplace_pack_unlocked := OLD.marketplace_pack_unlocked;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
