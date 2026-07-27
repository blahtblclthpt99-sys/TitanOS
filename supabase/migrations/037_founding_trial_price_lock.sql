-- 037: Founding 100 = first month free + lifetime price lock (not free forever).
-- New claims get founding_trial_ends_at (+30d), founding_price_lock, founding_locked_plan.
-- Legacy lifetime_premium founders keep their prior entitlement.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS founding_trial_ends_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS founding_price_lock numeric(10, 2);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS founding_locked_plan text;

COMMENT ON COLUMN public.profiles.founding_user IS
  'Founding 100 member — month-1 free then lifetime locked membership price.';
COMMENT ON COLUMN public.profiles.founding_trial_ends_at IS
  'End of free founding month; after this, pay founding_price_lock.';
COMMENT ON COLUMN public.profiles.founding_price_lock IS
  'Lifetime locked monthly price (e.g. 4.99 / 9.99 / 19.99).';
COMMENT ON COLUMN public.profiles.founding_locked_plan IS
  'Plan id locked at founding: starter | worker_premium | business.';

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
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_founding_slot(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cap int;
  claimed int;
  slot int;
  already boolean;
  trial_end timestamptz;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_user');
  END IF;

  SELECT founding_user INTO already
  FROM public.profiles
  WHERE id = p_user_id;

  IF already IS TRUE THEN
    SELECT founding_number INTO slot FROM public.profiles WHERE id = p_user_id;
    RETURN jsonb_build_object('ok', true, 'already', true, 'slot', slot);
  END IF;

  IF already IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_missing');
  END IF;

  PERFORM pg_advisory_xact_lock(87231401);

  SELECT founding_cap, founding_claimed
  INTO cap, claimed
  FROM public.platform_launch
  WHERE id = 1
  FOR UPDATE;

  IF cap IS NULL THEN
    cap := 100;
    claimed := 0;
  END IF;

  SELECT COUNT(*)::int INTO claimed
  FROM public.profiles
  WHERE founding_user = true;

  IF claimed >= cap THEN
    UPDATE public.platform_launch
    SET
      founding_claimed = claimed,
      beta_active = false,
      beta_closed_at = COALESCE(beta_closed_at, now()),
      updated_at = now()
    WHERE id = 1;
    RETURN jsonb_build_object(
      'ok', false,
      'beta_closed', true,
      'count', claimed,
      'cap', cap
    );
  END IF;

  slot := claimed + 1;
  trial_end := now() + interval '30 days';

  UPDATE public.profiles
  SET
    founding_user = true,
    founding_number = slot,
    founding_trial_ends_at = trial_end,
    founding_price_lock = 9.99,
    founding_locked_plan = 'worker_premium',
    -- Trial entitlement only (not free forever). Legacy backfill may still have lifetime_premium.
    lifetime_premium = false,
    is_pro = true,
    plan_tier = CASE
      WHEN plan_tier IS NULL OR btrim(plan_tier) = '' OR lower(plan_tier) IN ('worker_free', 'free', 'worker')
        THEN 'worker_premium'
      ELSE plan_tier
    END,
    updated_at = now()
  WHERE id = p_user_id
    AND founding_user = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'claim_race');
  END IF;

  UPDATE public.platform_launch
  SET
    founding_claimed = slot,
    beta_active = (slot < cap),
    beta_closed_at = CASE WHEN slot >= cap THEN COALESCE(beta_closed_at, now()) ELSE beta_closed_at END,
    updated_at = now()
  WHERE id = 1;

  RETURN jsonb_build_object(
    'ok', true,
    'slot', slot,
    'cap', cap,
    'trial_ends_at', trial_end,
    'price_lock', 9.99,
    'locked_plan', 'worker_premium',
    'beta_active', slot < cap,
    'membership_payments_live', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_founding_slot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_founding_slot(uuid) TO service_role;

-- Existing founders without trial window: grant 30-day trial from now if they
-- do not already have lifetime_premium (legacy free-forever keep as-is).
UPDATE public.profiles
SET
  founding_trial_ends_at = COALESCE(founding_trial_ends_at, now() + interval '30 days'),
  founding_price_lock = COALESCE(founding_price_lock, 9.99),
  founding_locked_plan = COALESCE(NULLIF(btrim(founding_locked_plan), ''), 'worker_premium')
WHERE founding_user = true
  AND lifetime_premium IS NOT TRUE
  AND founding_trial_ends_at IS NULL;

COMMIT;
