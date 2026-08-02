-- Feedback is accepted through the authenticated server endpoint. Prevent
-- anonymous callers from writing arbitrary records directly through PostgREST.
DROP POLICY IF EXISTS beta_feedbacks_insert ON public.beta_feedbacks;
CREATE POLICY beta_feedbacks_insert_own
  ON public.beta_feedbacks
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_beta_feedbacks_created_by
  ON public.beta_feedbacks(created_by_id);
