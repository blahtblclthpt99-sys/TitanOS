-- 018: Stripe webhook idempotency + production security notes
-- SAFETY: Additive only. Does not weaken existing RLS.
-- REQUIRES: Apply 016_hire_applications_rls.sql before or with this release
--            so hire_applications is no longer USING (true).

BEGIN;

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payment_id UUID,
  payload_summary JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed
  ON public.stripe_webhook_events (processed_at DESC);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role / backend only — no client policies (deny by default for authenticated)
DROP POLICY IF EXISTS stripe_webhook_events_admin ON public.stripe_webhook_events;
CREATE POLICY stripe_webhook_events_admin ON public.stripe_webhook_events
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Hire jobs: keep public browse (SELECT true) but ensure updates stay owner-scoped
-- (already set in 002). Document intentional board visibility.

COMMENT ON TABLE public.stripe_webhook_events IS
  'Idempotency ledger for Stripe webhooks — insert event_id before side effects.';

COMMIT;
