-- Harden platform_launch so impossible founding-beta state cannot be stored.
-- This migration deliberately fails instead of silently expanding the founding cap
-- if existing founding profiles already exceed the configured cap.

BEGIN;

-- Serialize with claim_founding_slot(), which uses the same advisory lock.
SELECT pg_advisory_xact_lock(87231401);

INSERT INTO public.platform_launch (id, founding_cap, founding_claimed, beta_active)
VALUES (1, 100, 0, true)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  v_cap integer;
  v_actual_claimed integer;
BEGIN
  SELECT founding_cap
  INTO v_cap
  FROM public.platform_launch
  WHERE id = 1
  FOR UPDATE;

  IF v_cap IS NULL OR v_cap < 1 OR v_cap > 1000000 THEN
    RAISE EXCEPTION 'platform_launch founding_cap is invalid: %', v_cap
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COUNT(*)::integer
  INTO v_actual_claimed
  FROM public.profiles
  WHERE founding_user IS TRUE;

  IF v_actual_claimed > v_cap THEN
    RAISE EXCEPTION
      'founding profile count (%) exceeds configured platform_launch founding_cap (%)',
      v_actual_claimed,
      v_cap
      USING ERRCODE = 'check_violation';
  END IF;

  -- Reconcile the cached counter from authoritative profile rows. Preserve an
  -- intentional early beta closure, but force beta closed when the cap is full.
  UPDATE public.platform_launch
  SET
    founding_claimed = v_actual_claimed,
    beta_active = CASE
      WHEN v_actual_claimed >= v_cap THEN false
      ELSE beta_active
    END,
    beta_closed_at = CASE
      WHEN v_actual_claimed >= v_cap THEN COALESCE(beta_closed_at, now())
      ELSE beta_closed_at
    END,
    updated_at = now()
  WHERE id = 1;
END
$$;

ALTER TABLE public.platform_launch
  DROP CONSTRAINT IF EXISTS platform_launch_founding_cap_range_chk,
  DROP CONSTRAINT IF EXISTS platform_launch_founding_claimed_range_chk,
  DROP CONSTRAINT IF EXISTS platform_launch_full_beta_closed_chk;

ALTER TABLE public.platform_launch
  ADD CONSTRAINT platform_launch_founding_cap_range_chk
    CHECK (founding_cap BETWEEN 1 AND 1000000),
  ADD CONSTRAINT platform_launch_founding_claimed_range_chk
    CHECK (founding_claimed BETWEEN 0 AND founding_cap),
  ADD CONSTRAINT platform_launch_full_beta_closed_chk
    CHECK (founding_claimed < founding_cap OR beta_active = false);

COMMENT ON CONSTRAINT platform_launch_founding_cap_range_chk ON public.platform_launch IS
  'Founding capacity must be a positive bounded integer.';
COMMENT ON CONSTRAINT platform_launch_founding_claimed_range_chk ON public.platform_launch IS
  'Cached founding claims cannot be negative or exceed the configured cap.';
COMMENT ON CONSTRAINT platform_launch_full_beta_closed_chk ON public.platform_launch IS
  'Beta cannot remain active after the founding cap is exhausted.';

COMMIT;
