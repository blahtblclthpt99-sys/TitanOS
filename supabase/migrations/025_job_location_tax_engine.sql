-- 025: Job Location fields + tax snapshot storage (sales tax by job situs)
-- Driver location remains on driver_profiles / client prefs and is NOT used for tax.

BEGIN;

-- Structured job / estimate / invoice situs (additive)
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS job_city TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS job_state TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS job_zip TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS job_county TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS job_country TEXT NOT NULL DEFAULT 'US';

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS job_city TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS job_state TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS job_zip TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS job_county TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS job_country TEXT NOT NULL DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS job_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS job_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS tax_exempt BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS job_location JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS job_city TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS job_state TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS job_zip TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS job_county TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS job_country TEXT NOT NULL DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS job_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS job_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS tax_exempt BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS job_location JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Optional server-side tax rule catalog (admin-managed). Client may also store rules locally.
CREATE TABLE IF NOT EXISTS public.tax_rules (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  country TEXT NOT NULL DEFAULT 'US',
  state TEXT NOT NULL DEFAULT '',
  county TEXT,
  city TEXT,
  postal_prefix TEXT,
  label TEXT NOT NULL DEFAULT '',
  rate_percent NUMERIC NOT NULL DEFAULT 0 CHECK (rate_percent >= 0 AND rate_percent <= 100),
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  tax_exempt_allowed BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  priority INT NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT ''
);

ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tax_rules_select ON public.tax_rules;
CREATE POLICY tax_rules_select ON public.tax_rules
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS tax_rules_admin_write ON public.tax_rules;
CREATE POLICY tax_rules_admin_write ON public.tax_rules
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON COLUMN public.estimates.tax_snapshot IS
  'Frozen Tax Engine result at create/recalc time. Historical docs keep these rates unless recalculated.';
COMMENT ON COLUMN public.estimates.job_location IS
  'Job Location (service situs). Never copy Driver Location here for tax purposes.';

COMMIT;
