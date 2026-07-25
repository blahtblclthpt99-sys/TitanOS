-- TitanOS Fee Engine — centralized configurable pricing (017)
-- SAFETY: Additive only. Does not drop existing payment columns or data.
-- Apply on Supabase before relying on DB-backed rates; server falls back to seed defaults until then.

BEGIN;

CREATE TABLE IF NOT EXISTS public.fee_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fee_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id TEXT NOT NULL REFERENCES public.fee_categories(id) ON DELETE CASCADE,
  -- Optional segment (plan, country, role). '*' = default for category.
  context_key TEXT NOT NULL DEFAULT '*',
  version INTEGER NOT NULL DEFAULT 1,
  label TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_until TIMESTAMPTZ,
  -- percentage | flat | tiered | composite
  rule_type TEXT NOT NULL DEFAULT 'percentage',
  percentage_rate NUMERIC NOT NULL DEFAULT 0,
  flat_amount NUMERIC NOT NULL DEFAULT 0,
  min_fee NUMERIC,
  max_fee NUMERIC,
  -- buyer = fee added to customer total; seller = fee deducted from merchant net
  fee_bearer TEXT NOT NULL DEFAULT 'buyer',
  processing_fee_rate NUMERIC NOT NULL DEFAULT 0,
  processing_fee_flat NUMERIC NOT NULL DEFAULT 0,
  tax_enabled BOOLEAN NOT NULL DEFAULT false,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  -- [{ "min": 0, "max": 100, "rate": 0.08 }, ...]
  tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- { "code": "LAUNCH", "percent_off": 0.5, "ends_at": "..." }
  promo JSONB,
  notes TEXT,
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_by UUID REFERENCES public.fee_rules(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS fee_rules_cat_ctx_version_uidx
  ON public.fee_rules (category_id, context_key, version);

CREATE INDEX IF NOT EXISTS fee_rules_active_idx
  ON public.fee_rules (category_id, context_key, enabled, effective_from DESC);

CREATE TABLE IF NOT EXISTS public.fee_rule_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_rule_id UUID NOT NULL REFERENCES public.fee_rules(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fee_calculation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT,
  payment_id UUID,
  category_id TEXT NOT NULL,
  fee_rule_id UUID,
  fee_version INTEGER,
  context_key TEXT,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  gross_amount NUMERIC NOT NULL DEFAULT 0,
  platform_fee NUMERIC NOT NULL DEFAULT 0,
  processing_fee NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  final_total NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS fee_calc_logs_tx_idx ON public.fee_calculation_logs (transaction_id);
CREATE INDEX IF NOT EXISTS fee_calc_logs_payment_idx ON public.fee_calculation_logs (payment_id);
CREATE INDEX IF NOT EXISTS fee_calc_logs_time_idx ON public.fee_calculation_logs (calculated_at DESC);

ALTER TABLE public.fee_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_rule_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_calculation_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read active fee config (display / transparency). Writes = admin/service role.
DROP POLICY IF EXISTS fee_categories_select ON public.fee_categories;
CREATE POLICY fee_categories_select ON public.fee_categories
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS fee_rules_select ON public.fee_rules;
CREATE POLICY fee_rules_select ON public.fee_rules
  FOR SELECT TO authenticated
  USING (enabled = true);

DROP POLICY IF EXISTS fee_categories_admin ON public.fee_categories;
CREATE POLICY fee_categories_admin ON public.fee_categories
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS fee_rules_admin ON public.fee_rules;
CREATE POLICY fee_rules_admin ON public.fee_rules
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS fee_history_admin ON public.fee_rule_history;
CREATE POLICY fee_history_admin ON public.fee_rule_history
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS fee_history_admin_write ON public.fee_rule_history;
CREATE POLICY fee_history_admin_write ON public.fee_rule_history
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS fee_logs_own ON public.fee_calculation_logs;
CREATE POLICY fee_logs_own ON public.fee_calculation_logs
  FOR SELECT TO authenticated
  USING (public.is_admin() OR created_by_id = auth.uid());

-- Seed categories
INSERT INTO public.fee_categories (id, name, description, sort_order) VALUES
  ('marketplace_sales', 'Marketplace Sales', 'Fees on marketplace listing sales', 10),
  ('driver_services', 'Driver Services', 'Haul / driver marketplace fees', 20),
  ('service_requests', 'Service Requests', 'Invoice and payment collection fees', 30),
  ('subscriptions', 'Subscriptions', 'Recurring plan subscription pricing', 40),
  ('premium_membership', 'Premium Membership', 'Worker Premium / Business membership', 50),
  ('featured_listings', 'Featured Listings', 'Boosted marketplace listings', 60),
  ('promoted_posts', 'Promoted Posts', 'Community / marketing promotions', 70),
  ('advertising', 'Advertising', 'Paid advertising products', 80)
ON CONFLICT (id) DO NOTHING;

-- Seed active rules matching current plan.js rates (service_requests by plan context)
INSERT INTO public.fee_rules (
  category_id, context_key, version, label, rule_type, percentage_rate, fee_bearer, notes
) VALUES
  ('service_requests', 'customer', 1, 'Customer 0%', 'percentage', 0, 'buyer', 'Seed from launch pricing'),
  ('service_requests', 'worker_free', 1, 'Worker Free 8%', 'percentage', 0.08, 'buyer', 'Seed from launch pricing'),
  ('service_requests', 'worker_premium', 1, 'Worker Premium 2.5%', 'percentage', 0.025, 'buyer', 'Seed from launch pricing'),
  ('service_requests', 'business', 1, 'Business 1.5%', 'percentage', 0.015, 'buyer', 'Seed from launch pricing'),
  ('marketplace_sales', '*', 1, 'Marketplace default 8%', 'percentage', 0.08, 'buyer', 'Seed default'),
  ('driver_services', '*', 1, 'Driver services default 8%', 'percentage', 0.08, 'buyer', 'Seed default'),
  ('featured_listings', '*', 1, 'Featured listing flat', 'flat', 0, 'buyer', 'Use flat_amount'),
  ('subscriptions', '*', 1, 'Subscription passthrough', 'flat', 0, 'buyer', 'Plan prices live in plan catalog'),
  ('premium_membership', '*', 1, 'Membership passthrough', 'flat', 0, 'buyer', 'Plan prices live in plan catalog'),
  ('promoted_posts', '*', 1, 'Promoted posts default', 'flat', 0, 'buyer', 'Disabled until product live'),
  ('advertising', '*', 1, 'Advertising default', 'flat', 0, 'buyer', 'Disabled until product live')
ON CONFLICT DO NOTHING;

-- Featured listing flat amount (update seed row)
UPDATE public.fee_rules
SET flat_amount = 9.99, percentage_rate = 0, rule_type = 'flat', label = 'Featured listing $9.99'
WHERE category_id = 'featured_listings' AND context_key = '*' AND version = 1;

COMMIT;
