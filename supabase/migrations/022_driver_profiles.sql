-- 022: Driver profiles for live Driver Hub directory (opt-in publish)
-- SAFETY: Additive. No seed/fake drivers.

BEGIN;

CREATE TABLE IF NOT EXISTS public.driver_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  zip TEXT NOT NULL DEFAULT '',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  vehicle_type TEXT NOT NULL DEFAULT '',
  vehicle_make TEXT NOT NULL DEFAULT '',
  vehicle_model TEXT NOT NULL DEFAULT '',
  vehicle_year INT,
  vehicle_capacity_lbs INT,
  vehicle_length_ft INT,
  vehicle_tags TEXT[] NOT NULL DEFAULT '{}',
  license_class TEXT NOT NULL DEFAULT 'Non-CDL',
  years_experience INT NOT NULL DEFAULT 0,
  rate_hourly NUMERIC NOT NULL DEFAULT 0,
  availability TEXT NOT NULL DEFAULT 'offline'
    CHECK (availability IN ('available', 'busy', 'offline')),
  routes TEXT[] NOT NULL DEFAULT '{}',
  skills TEXT[] NOT NULL DEFAULT '{}',
  certifications TEXT[] NOT NULL DEFAULT '{}',
  insured BOOLEAN NOT NULL DEFAULT false,
  background_checked BOOLEAN NOT NULL DEFAULT false,
  id_verified BOOLEAN NOT NULL DEFAULT false,
  published BOOLEAN NOT NULL DEFAULT false,
  completed_jobs INT NOT NULL DEFAULT 0,
  rating NUMERIC NOT NULL DEFAULT 0,
  review_count INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS driver_profiles_published_idx
  ON public.driver_profiles (published, availability)
  WHERE published = true;

CREATE INDEX IF NOT EXISTS driver_profiles_city_idx
  ON public.driver_profiles (city);

ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS driver_profiles_select ON public.driver_profiles;
CREATE POLICY driver_profiles_select ON public.driver_profiles
  FOR SELECT TO authenticated
  USING (published = true OR user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS driver_profiles_insert ON public.driver_profiles;
CREATE POLICY driver_profiles_insert ON public.driver_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND created_by_id = auth.uid());

DROP POLICY IF EXISTS driver_profiles_update ON public.driver_profiles;
CREATE POLICY driver_profiles_update ON public.driver_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS driver_profiles_delete ON public.driver_profiles;
CREATE POLICY driver_profiles_delete ON public.driver_profiles
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

COMMIT;
