-- Protect Titan Autopilot delivery evidence from ordinary authenticated client
-- mutation. Autopilot runners use the service role and bypass RLS; signed-in
-- owners may still read their own rows, but cannot create/update/delete
-- autopilot_run:* records through generic entity APIs.

DROP POLICY IF EXISTS follow_queue_own ON public.follow_up_queue;
DROP POLICY IF EXISTS follow_queue_select_own ON public.follow_up_queue;
DROP POLICY IF EXISTS follow_queue_insert_own_non_autopilot ON public.follow_up_queue;
DROP POLICY IF EXISTS follow_queue_update_own_non_autopilot ON public.follow_up_queue;
DROP POLICY IF EXISTS follow_queue_delete_own_non_autopilot ON public.follow_up_queue;

CREATE POLICY follow_queue_select_own
  ON public.follow_up_queue
  FOR SELECT
  TO authenticated
  USING (created_by_id = auth.uid());

CREATE POLICY follow_queue_insert_own_non_autopilot
  ON public.follow_up_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by_id = auth.uid()
    AND COALESCE(rule_id, '') NOT LIKE 'autopilot_run:%'
  );

CREATE POLICY follow_queue_update_own_non_autopilot
  ON public.follow_up_queue
  FOR UPDATE
  TO authenticated
  USING (
    created_by_id = auth.uid()
    AND COALESCE(rule_id, '') NOT LIKE 'autopilot_run:%'
  )
  WITH CHECK (
    created_by_id = auth.uid()
    AND COALESCE(rule_id, '') NOT LIKE 'autopilot_run:%'
  );

CREATE POLICY follow_queue_delete_own_non_autopilot
  ON public.follow_up_queue
  FOR DELETE
  TO authenticated
  USING (
    created_by_id = auth.uid()
    AND COALESCE(rule_id, '') NOT LIKE 'autopilot_run:%'
  );
