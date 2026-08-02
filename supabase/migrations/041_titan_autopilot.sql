-- Titan Autopilot: recipient address required for auditable follow-up delivery.
ALTER TABLE public.follow_up_queue
  ADD COLUMN IF NOT EXISTS customer_email TEXT;

CREATE INDEX IF NOT EXISTS idx_followups_owner_status
  ON public.follow_up_queue(created_by_id, status, scheduled_for DESC);

COMMENT ON COLUMN public.follow_up_queue.customer_email IS
  'Recipient approved by the owning user for this specific follow-up.';
