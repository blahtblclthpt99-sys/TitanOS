-- Titan Autopilot free-access execution ledger.
-- Monetization is intentionally out of scope for this release. This table is
-- service-managed so retries preserve the exact owner-approved recipients.

CREATE TABLE IF NOT EXISTS public.autopilot_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','retryable','completed','failed')),
  invoice_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  recipient_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  prepared_count INTEGER NOT NULL DEFAULT 0 CHECK (prepared_count >= 0),
  sent_count INTEGER NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  pending_count INTEGER NOT NULL DEFAULT 0 CHECK (pending_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_autopilot_runs_user_created
  ON public.autopilot_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_autopilot_runs_user_status
  ON public.autopilot_runs(user_id, status, updated_at DESC);

ALTER TABLE public.autopilot_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.autopilot_runs FROM anon, authenticated;
DROP POLICY IF EXISTS autopilot_runs_no_client ON public.autopilot_runs;
CREATE POLICY autopilot_runs_no_client
  ON public.autopilot_runs
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.autopilot_runs IS
  'Service-managed execution leases and exact recipient approval evidence for free Titan Autopilot recovery sprints.';

-- Keep historical paid-mode telemetry readable while making the active product
-- free. PostgreSQL names these inline CHECK constraints deterministically.
ALTER TABLE public.autopilot_funnel_events
  DROP CONSTRAINT IF EXISTS autopilot_funnel_events_event_name_check;
ALTER TABLE public.autopilot_funnel_events
  ADD CONSTRAINT autopilot_funnel_events_event_name_check CHECK (event_name IN (
    'preview_view',
    'signed_in_view',
    'eligible_loaded',
    'batch_approved',
    'checkout_started',
    'checkout_returned',
    'membership_run_started',
    'one_time_run_started',
    'free_run_started',
    'run_completed',
    'run_retryable',
    'run_failed'
  ));

ALTER TABLE public.autopilot_funnel_events
  DROP CONSTRAINT IF EXISTS autopilot_funnel_events_mode_check;
ALTER TABLE public.autopilot_funnel_events
  ADD CONSTRAINT autopilot_funnel_events_mode_check
  CHECK (mode IN ('public','one_time','membership','free','unknown'));
