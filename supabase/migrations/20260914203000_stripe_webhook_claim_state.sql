-- Retry-safe claim state for the canonical Stripe webhook idempotency ledger.
-- Existing rows represent events that were already accepted by the legacy
-- handler, so they are backfilled/defaulted as processed. New Autopilot events
-- use processing -> processed/failed leases and can reclaim failed/stale work.

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'processed',
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

DO $$ BEGIN
  ALTER TABLE public.stripe_webhook_events
    ADD CONSTRAINT stripe_webhook_events_processing_status_check
    CHECK (processing_status IN ('processing','processed','failed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.stripe_webhook_events
    ADD CONSTRAINT stripe_webhook_events_attempt_count_check
    CHECK (attempt_count >= 1);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_claim_state
  ON public.stripe_webhook_events(processing_status, claimed_at);

COMMENT ON COLUMN public.stripe_webhook_events.processing_status IS
  'Webhook claim lifecycle. processed is terminal; failed or stale processing may be reclaimed.';
