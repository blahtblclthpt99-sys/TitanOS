-- Career-core trust lockdown.
-- professional_profile is user-editable JSONB, but verification, reputation,
-- completed-job counts and Titan scores are platform-owned trust claims.
-- Strip those keys for all non-admin/non-service profile updates and clean
-- previously persisted untrusted nested claims.

BEGIN;

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

    IF NEW.professional_profile IS DISTINCT FROM OLD.professional_profile THEN
      NEW.professional_profile := COALESCE(NEW.professional_profile, '{}'::jsonb)
        - ARRAY[
            'verified',
            'verification_notes',
            'badges',
            'jobs_completed',
            'years_experience',
            'rating',
            'review_count',
            'reliability_rate',
            'titan_score'
          ];
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- The trigger was introduced in 021_privilege_money_integrity.sql. Recreate it
-- defensively so environments that skipped the earlier migration still receive
-- the protection when this migration is applied.
DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileges();

-- Remove stale nested trust claims written before this boundary existed. The
-- authoritative top-level verified_worker / verification_notes columns remain
-- unchanged and continue to be server/admin owned.
UPDATE public.profiles
SET professional_profile = COALESCE(professional_profile, '{}'::jsonb)
  - ARRAY[
      'verified',
      'verification_notes',
      'badges',
      'jobs_completed',
      'years_experience',
      'rating',
      'review_count',
      'reliability_rate',
      'titan_score'
    ],
    updated_at = now()
WHERE COALESCE(professional_profile, '{}'::jsonb) ?| ARRAY[
  'verified',
  'verification_notes',
  'badges',
  'jobs_completed',
  'years_experience',
  'rating',
  'review_count',
  'reliability_rate',
  'titan_score'
];

COMMENT ON COLUMN public.profiles.professional_profile IS
  'User-authored professional profile content. Verification, reputation, completed-job counts, reliability and Titan scores are prohibited nested claims and remain platform-owned.';

COMMIT;
