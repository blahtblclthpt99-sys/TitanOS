-- 024: Extensible vehicle capacity JSON on driver profiles
-- FUTURE: multiple vehicles, photos, VIN, trailers, equipment, hazmat, verification

BEGIN;

ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS vehicle_capacity JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.driver_profiles.vehicle_capacity IS
  'Driver-entered vehicle capacity (schema v1+). Dimensions stored in inches; weight in lb. Never invent manufacturer specs.';

COMMIT;
