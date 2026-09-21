-- Compatibility follow-up for environments where the verified-auth Founding
-- migration was applied before discovering that the optional Founding tables or
-- profile columns were absent. Fresh environments also apply this idempotently.

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
  founding_columns int;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_user');
  END IF;

  SELECT COUNT(*)::int INTO founding_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name IN (
      'founding_user','founding_number','founding_trial_ends_at',
      'founding_price_lock','founding_locked_plan','lifetime_premium',
      'is_pro','plan_tier'
    );

  IF to_regclass('public.platform_launch') IS NULL OR founding_columns < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'founding_unavailable');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = p_user_id
      AND (u.email_confirmed_at IS NOT NULL OR u.phone_confirmed_at IS NOT NULL)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unverified_user');
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
    SET founding_claimed = claimed,
        beta_active = false,
        beta_closed_at = COALESCE(beta_closed_at, now()),
        updated_at = now()
    WHERE id = 1;
    RETURN jsonb_build_object('ok', false, 'beta_closed', true, 'count', claimed, 'cap', cap);
  END IF;

  slot := claimed + 1;
  trial_end := now() + interval '30 days';

  UPDATE public.profiles
  SET founding_user = true,
      founding_number = slot,
      founding_trial_ends_at = trial_end,
      founding_price_lock = 9.99,
      founding_locked_plan = 'worker_premium',
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
  SET founding_claimed = slot,
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

REVOKE ALL ON FUNCTION public.claim_founding_slot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_founding_slot(uuid) TO service_role;
