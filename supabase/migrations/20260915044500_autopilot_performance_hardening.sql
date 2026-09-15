-- Titan Autopilot performance hardening after the atomic delivery guard.

-- The composite primary key starts with user_id, so invoice_id also needs its
-- own covering index for efficient invoice deletes / FK maintenance.
CREATE INDEX IF NOT EXISTS idx_autopilot_delivery_guards_invoice
  ON public.autopilot_invoice_delivery_guards(invoice_id);

-- Preserve the exact Recovery Receipt security semantics while allowing
-- PostgreSQL to initialize auth.uid() once per statement rather than per row.
DROP POLICY IF EXISTS follow_queue_select_own ON public.follow_up_queue;
DROP POLICY IF EXISTS follow_queue_insert_own_non_autopilot ON public.follow_up_queue;
DROP POLICY IF EXISTS follow_queue_update_own_non_autopilot ON public.follow_up_queue;
DROP POLICY IF EXISTS follow_queue_delete_own_non_autopilot ON public.follow_up_queue;

CREATE POLICY follow_queue_select_own
  ON public.follow_up_queue
  FOR SELECT
  TO authenticated
  USING (created_by_id = (SELECT auth.uid()));

CREATE POLICY follow_queue_insert_own_non_autopilot
  ON public.follow_up_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by_id = (SELECT auth.uid())
    AND COALESCE(rule_id, '') NOT LIKE 'autopilot_run:%'
  );

CREATE POLICY follow_queue_update_own_non_autopilot
  ON public.follow_up_queue
  FOR UPDATE
  TO authenticated
  USING (
    created_by_id = (SELECT auth.uid())
    AND COALESCE(rule_id, '') NOT LIKE 'autopilot_run:%'
  )
  WITH CHECK (
    created_by_id = (SELECT auth.uid())
    AND COALESCE(rule_id, '') NOT LIKE 'autopilot_run:%'
  );

CREATE POLICY follow_queue_delete_own_non_autopilot
  ON public.follow_up_queue
  FOR DELETE
  TO authenticated
  USING (
    created_by_id = (SELECT auth.uid())
    AND COALESCE(rule_id, '') NOT LIKE 'autopilot_run:%'
  );
