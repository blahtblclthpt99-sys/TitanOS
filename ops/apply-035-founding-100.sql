-- 035: First 100 users get free app membership (fees still apply).
-- After 100 founding slots are claimed, beta closes and membership checkout goes live.
-- Founding users keep lifetime_premium / worker_premium access forever.

BEGIN;

-- ── Launch control row ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_launch (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  founding_cap int NOT NULL DEFAULT 100,
  founding_claimed int NOT NULL DEFAULT 0,
  beta_active boolean NOT NULL DEFAULT true,
  beta_closed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_launch (id, founding_cap, founding_claimed, beta_active)
VALUES (1, 100, 0, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_launch ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_launch_public_read ON public.platform_launch;
CREATE POLICY platform_launch_public_read ON public.platform_launch
  FOR SELECT TO anon, authenticated
  USING (true);

-- No client writes — service_role / SECURITY DEFINER only.

-- ── Profile founding columns ───────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS founding_user boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS founding_number int;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_founding_number_uidx
  ON public.profiles (founding_number)
  WHERE founding_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_founding_user_idx
  ON public.profiles (founding_user)
  WHERE founding_user = true;

COMMENT ON COLUMN public.profiles.founding_user IS
  'First 100 signups — free membership forever; transaction fees still apply.';

-- Lock founding_* on client updates (extends privilege protect)
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
  END IF;
  RETURN NEW;
END;
$$;

-- ── Atomic claim ───────────────────────────────────────────────────────────
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

  -- Prefer live count of founding rows over cached counter
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

  UPDATE public.profiles
  SET
    founding_user = true,
    founding_number = slot,
    lifetime_premium = true,
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
    'beta_active', slot < cap,
    'membership_payments_live', slot >= cap
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_founding_slot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_founding_slot(uuid) TO service_role;

-- Auto-claim on every new profile (email register + OAuth)
CREATE OR REPLACE FUNCTION public.profiles_auto_claim_founding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.claim_founding_slot(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_auto_claim_founding ON public.profiles;
CREATE TRIGGER trg_profiles_auto_claim_founding
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_auto_claim_founding();

-- Backfill earliest accounts up to cap (idempotent)
DO $$
DECLARE
  cap int := 100;
  r record;
  n int := 0;
BEGIN
  SELECT COALESCE(founding_cap, 100) INTO cap FROM public.platform_launch WHERE id = 1;
  FOR r IN
    SELECT id
    FROM public.profiles
    WHERE founding_user = false
    ORDER BY created_at ASC NULLS LAST, id ASC
    LIMIT cap
  LOOP
    EXIT WHEN (
      SELECT COUNT(*) FROM public.profiles WHERE founding_user = true
    ) >= cap;
    PERFORM public.claim_founding_slot(r.id);
  END LOOP;

  SELECT COUNT(*)::int INTO n FROM public.profiles WHERE founding_user = true;
  UPDATE public.platform_launch
  SET
    founding_claimed = n,
    beta_active = (n < cap),
    beta_closed_at = CASE WHEN n >= cap THEN COALESCE(beta_closed_at, now()) ELSE beta_closed_at END,
    updated_at = now()
  WHERE id = 1;
END $$;

COMMIT;
