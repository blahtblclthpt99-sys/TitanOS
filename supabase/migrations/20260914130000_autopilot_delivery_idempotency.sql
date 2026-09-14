-- Titan Autopilot: enforce one audited queue record per approved delivery target
-- and retain provider-level evidence for successful/failed delivery attempts.
-- Existing legacy Autopilot rows are unaffected because the new runner uses the
-- autopilot_run: prefix while older rule_id values used different formats.

ALTER TABLE public.follow_up_queue
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS delivery_error_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_followup_autopilot_run_once
  ON public.follow_up_queue (created_by_id, rule_id)
  WHERE rule_id LIKE 'autopilot_run:%';

CREATE INDEX IF NOT EXISTS idx_followup_provider_message_id
  ON public.follow_up_queue (provider_message_id)
  WHERE provider_message_id IS NOT NULL;
