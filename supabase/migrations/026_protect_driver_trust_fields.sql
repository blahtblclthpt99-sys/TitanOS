-- 026: Lock driver trust / reputation fields to server/admin only
-- Complements 023 (id_verified). Clients must not self-set insured, background, ratings.

BEGIN;

CREATE OR REPLACE FUNCTION public.protect_driver_trust_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_admin() THEN
      NEW.insured := false;
      NEW.background_checked := false;
      NEW.rating := 0;
      NEW.review_count := 0;
      NEW.completed_jobs := 0;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NOT public.is_admin() THEN
      NEW.insured := OLD.insured;
      NEW.background_checked := OLD.background_checked;
      NEW.rating := OLD.rating;
      NEW.review_count := OLD.review_count;
      NEW.completed_jobs := OLD.completed_jobs;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_driver_trust_fields ON public.driver_profiles;
CREATE TRIGGER trg_protect_driver_trust_fields
  BEFORE INSERT OR UPDATE ON public.driver_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_driver_trust_fields();

COMMENT ON FUNCTION public.protect_driver_trust_fields() IS
  'Prevents non-admin clients from forging insured/background/rating/completed_jobs on driver_profiles.';

COMMIT;
