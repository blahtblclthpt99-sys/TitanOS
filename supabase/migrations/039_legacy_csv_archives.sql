-- 039: Legacy CSV archive tables for safe Base44-era data intake
-- Additive only. No existing runtime tables or Android artifacts are modified.

BEGIN;

CREATE TABLE IF NOT EXISTS public.legacy_import_id_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  entity_name TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id TEXT NOT NULL,
  source_file TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (entity_name, source_id)
);

CREATE TABLE IF NOT EXISTS public.legacy_vehicle_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_file TEXT NOT NULL,
  source_id TEXT,
  source_hash TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (source_file, source_hash)
);

CREATE TABLE IF NOT EXISTS public.legacy_area_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_file TEXT NOT NULL,
  source_id TEXT,
  source_hash TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (source_file, source_hash)
);

CREATE TABLE IF NOT EXISTS public.legacy_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_file TEXT NOT NULL,
  source_id TEXT,
  source_hash TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (source_file, source_hash)
);

CREATE TABLE IF NOT EXISTS public.legacy_base44_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_file TEXT NOT NULL,
  source_id TEXT,
  source_hash TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (source_file, source_hash)
);

CREATE TABLE IF NOT EXISTS public.legacy_fuel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_file TEXT NOT NULL,
  source_id TEXT,
  source_hash TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (source_file, source_hash)
);

CREATE TABLE IF NOT EXISTS public.legacy_gig_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_file TEXT NOT NULL,
  source_id TEXT,
  source_hash TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (source_file, source_hash)
);

CREATE TABLE IF NOT EXISTS public.legacy_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_file TEXT NOT NULL,
  source_id TEXT,
  source_hash TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (source_file, source_hash)
);

CREATE TABLE IF NOT EXISTS public.legacy_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_file TEXT NOT NULL,
  source_id TEXT,
  source_hash TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (source_file, source_hash)
);

CREATE TABLE IF NOT EXISTS public.legacy_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_file TEXT NOT NULL,
  source_id TEXT,
  source_hash TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (source_file, source_hash)
);

CREATE TABLE IF NOT EXISTS public.legacy_learning_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  relative_path TEXT NOT NULL,
  script_name TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  script_text TEXT NOT NULL,
  UNIQUE (relative_path, content_sha256)
);

CREATE INDEX IF NOT EXISTS idx_legacy_import_id_map_entity_source
  ON public.legacy_import_id_map (entity_name, source_id);

ALTER TABLE public.legacy_import_id_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_vehicle_capacity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_area_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_base44_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_fuel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_gig_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_learning_scripts ENABLE ROW LEVEL SECURITY;

COMMIT;