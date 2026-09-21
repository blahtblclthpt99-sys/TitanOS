-- Titan Autopilot launch telemetry.
-- Store only coarse, allow-listed funnel metadata. Do not persist customer names,
-- email addresses, invoice IDs/numbers, message bodies, raw referrers, IPs, or exact balances.

CREATE TABLE IF NOT EXISTS public.autopilot_funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL CHECK (event_name IN (
    'preview_view',
    'signed_in_view',
    'eligible_loaded',
    'batch_approved',
    'checkout_started',
    'checkout_returned',
    'membership_run_started',
    'one_time_run_started',
    'run_completed',
    'run_retryable',
    'run_failed'
  )),
  source TEXT NOT NULL DEFAULT 'direct' CHECK (source IN ('product_hunt','direct','other')),
  mode TEXT NOT NULL DEFAULT 'unknown' CHECK (mode IN ('public','one_time','membership','unknown')),
  invoice_count INTEGER CHECK (invoice_count IS NULL OR (invoice_count >= 0 AND invoice_count <= 10)),
  outcome TEXT CHECK (outcome IS NULL OR outcome IN ('completed','retryable','failed','canceled','pending','prepared'))
);

ALTER TABLE public.autopilot_funnel_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.autopilot_funnel_events FROM anon, authenticated;

DROP POLICY IF EXISTS autopilot_funnel_events_no_client ON public.autopilot_funnel_events;
CREATE POLICY autopilot_funnel_events_no_client
  ON public.autopilot_funnel_events
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_autopilot_funnel_events_name_created
  ON public.autopilot_funnel_events(event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_autopilot_funnel_events_user_created
  ON public.autopilot_funnel_events(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
