-- PayPal webhook idempotency (membership upgrades from NCP / Checkout)
CREATE TABLE IF NOT EXISTS public.paypal_webhook_events (
  event_id text PRIMARY KEY,
  event_type text,
  payload_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.paypal_webhook_events ENABLE ROW LEVEL SECURITY;

-- No client policies — service role only (same pattern as stripe_webhook_events)
DROP POLICY IF EXISTS paypal_webhook_events_no_client ON public.paypal_webhook_events;
CREATE POLICY paypal_webhook_events_no_client
  ON public.paypal_webhook_events
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.paypal_webhook_events IS
  'Idempotency ledger for PayPal webhooks. Written only by server service role.';
