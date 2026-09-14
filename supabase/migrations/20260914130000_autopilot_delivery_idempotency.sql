-- Titan Autopilot: enforce one audited queue record per approved delivery target.
-- Existing legacy Autopilot rows are unaffected because the new runner uses the
-- autopilot_run: prefix while older rule_id values used different formats.
CREATE UNIQUE INDEX IF NOT EXISTS idx_followup_autopilot_run_once
  ON public.follow_up_queue (created_by_id, rule_id)
  WHERE rule_id LIKE 'autopilot_run:%';
