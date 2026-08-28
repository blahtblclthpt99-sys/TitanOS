-- Lock profile referral attribution and active-company context at the database boundary.
--
-- `referred_by_code` is set by the authenticated server-side referral workflow,
-- not by generic client profile edits. `active_company_id` is context only, but
-- it must still reference a company the user owns or actively belongs to so the
-- UI cannot be switched into an unrelated tenant by an arbitrary client write.

BEGIN;

REVOKE UPDATE ON TABLE public.profiles FROM authenticated;

GRANT UPDATE (
  full_name,
  phone,
  username,
  avatar_url,
  bio,
  city,
  state,
  company_name,
  company_address,
  company_city,
  company_state,
  company_zip,
  company_logo_url,
  theme_pref,
  notification_prefs,
  marketing_prefs,
  privacy_prefs,
  professional_profile,
  community_opt_in,
  referral_code,
  active_company_id,
  updated_at
) ON TABLE public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_profile_context_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text := COALESCE(auth.role(), '');
BEGIN
  -- Trusted server/admin workflows may set referral attribution after their own
  -- authorization/fraud checks. Normal authenticated clients may not.
  IF v_role <> 'service_role'
     AND NEW.referred_by_code IS DISTINCT FROM OLD.referred_by_code THEN
    RAISE EXCEPTION 'Referral attribution is server-managed'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.active_company_id IS DISTINCT FROM OLD.active_company_id THEN
    -- Empty company context is always safe.
    IF NEW.active_company_id IS NULL OR btrim(NEW.active_company_id) = '' THEN
      RETURN NEW;
    END IF;

    -- Service-role handlers are responsible for performing the equivalent
    -- authorization check before mutating the profile.
    IF v_role = 'service_role' THEN
      RETURN NEW;
    END IF;

    IF v_uid IS NULL THEN
      RAISE EXCEPTION 'Authentication required'
        USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id::text = NEW.active_company_id
        AND (
          c.owner_id = v_uid::text
          OR c.created_by_id = v_uid
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.company_members m
      WHERE m.company_id = NEW.active_company_id
        AND m.user_id = v_uid::text
        AND m.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Company access denied'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_context_integrity ON public.profiles;
CREATE TRIGGER trg_profiles_context_integrity
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_context_integrity();

REVOKE ALL ON FUNCTION public.enforce_profile_context_integrity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_profile_context_integrity() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_profile_context_integrity() TO service_role;

COMMENT ON FUNCTION public.enforce_profile_context_integrity() IS
  'Prevents client-side referral attribution changes and unrelated active-company context selection.';

COMMIT;
