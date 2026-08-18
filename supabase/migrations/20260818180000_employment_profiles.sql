-- TitanOS neutral employment profiles.
-- Recruiting/job matching must not depend on driver, vehicle, rating, or precise-location data.

BEGIN;

CREATE TABLE IF NOT EXISTS public.employment_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  display_name text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  skills text[] NOT NULL DEFAULT '{}',
  qualifications text[] NOT NULL DEFAULT '{}',
  years_experience integer NOT NULL DEFAULT 0 CHECK (years_experience BETWEEN 0 AND 80),
  availability text NOT NULL DEFAULT 'available' CHECK (availability IN ('available','busy','offline')),
  discoverable boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS employment_profiles_discovery_idx
  ON public.employment_profiles (discoverable, availability, state, city)
  WHERE discoverable = true;

ALTER TABLE public.employment_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employment_profiles_select ON public.employment_profiles;
CREATE POLICY employment_profiles_select ON public.employment_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR discoverable = true);

DROP POLICY IF EXISTS employment_profiles_insert ON public.employment_profiles;
CREATE POLICY employment_profiles_insert ON public.employment_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND created_by_id = auth.uid());

DROP POLICY IF EXISTS employment_profiles_update ON public.employment_profiles;
CREATE POLICY employment_profiles_update ON public.employment_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND created_by_id = auth.uid());

DROP POLICY IF EXISTS employment_profiles_delete ON public.employment_profiles;
CREATE POLICY employment_profiles_delete ON public.employment_profiles
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.employment_profiles IS
  'Neutral opt-in employment profile used by Job Seeker and Business Talent. No vehicle, rating, precise coordinates, pay preference, home address, or engagement score belongs here.';
COMMENT ON COLUMN public.employment_profiles.discoverable IS
  'Explicit consent for matching businesses to discover this professional employment profile.';

-- One-time continuity backfill from legacy driver profiles. Only neutral professional
-- fields are copied; vehicle, rating, driving, precise-location and other driver-only
-- fields are intentionally excluded.
INSERT INTO public.employment_profiles (
  user_id,
  created_by_id,
  display_name,
  bio,
  city,
  state,
  skills,
  qualifications,
  years_experience,
  availability,
  discoverable,
  created_at,
  updated_at
)
SELECT
  d.user_id,
  d.user_id,
  COALESCE(NULLIF(BTRIM(d.name), ''), NULLIF(BTRIM(p.full_name), ''), 'Titan worker'),
  COALESCE(d.bio, ''),
  COALESCE(d.city, ''),
  COALESCE(d.state, ''),
  COALESCE(d.skills, '{}'::text[]),
  COALESCE(d.certifications, '{}'::text[]),
  GREATEST(0, LEAST(80, COALESCE(d.years_experience, 0))),
  CASE WHEN d.availability IN ('available','busy','offline') THEN d.availability ELSE 'available' END,
  COALESCE(d.published, false),
  COALESCE(d.created_at, now()),
  COALESCE(d.updated_at, now())
FROM public.driver_profiles d
LEFT JOIN public.profiles p ON p.id = d.user_id
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
