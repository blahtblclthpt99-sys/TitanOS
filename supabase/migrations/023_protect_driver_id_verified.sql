-- 023: Driver profiles — clients cannot self-set id_verified
BEGIN;

CREATE OR REPLACE FUNCTION public.protect_driver_id_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin() THEN
    NEW.id_verified := OLD.id_verified;
  END IF;
  IF TG_OP = 'INSERT'
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin() THEN
    NEW.id_verified := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_driver_id_verified ON public.driver_profiles;
CREATE TRIGGER trg_protect_driver_id_verified
  BEFORE INSERT OR UPDATE ON public.driver_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_driver_id_verified();

COMMIT;
