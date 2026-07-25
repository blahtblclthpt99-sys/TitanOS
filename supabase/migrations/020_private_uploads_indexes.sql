-- 020: Private uploads + indexes + beta spam reduction
-- SAFETY: Makes titanos-uploads private; own-folder access; public/ prefix for marketing assets.
-- Existing public object URLs will stop working until re-issued as signed URLs or moved under public/.

BEGIN;

-- Private bucket (objects under {uid}/… are owner-only; public/{uid}/… readable by anyone)
UPDATE storage.buckets
SET public = false
WHERE id = 'titanos-uploads';

DROP POLICY IF EXISTS titanos_uploads_read ON storage.objects;
DROP POLICY IF EXISTS titanos_uploads_insert ON storage.objects;
DROP POLICY IF EXISTS titanos_uploads_delete ON storage.objects;
DROP POLICY IF EXISTS titanos_uploads_select_own ON storage.objects;
DROP POLICY IF EXISTS titanos_uploads_select_public ON storage.objects;
DROP POLICY IF EXISTS titanos_uploads_insert_own ON storage.objects;
DROP POLICY IF EXISTS titanos_uploads_delete_own ON storage.objects;

-- Private files: first path segment = auth.uid()
CREATE POLICY titanos_uploads_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'titanos-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Marketing / avatar assets intentionally shareable
CREATE POLICY titanos_uploads_select_public ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'titanos-uploads'
    AND (storage.foldername(name))[1] = 'public'
  );

CREATE POLICY titanos_uploads_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'titanos-uploads'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        (storage.foldername(name))[1] = 'public'
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

CREATE POLICY titanos_uploads_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'titanos-uploads'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        (storage.foldername(name))[1] = 'public'
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
      OR owner = auth.uid()
    )
  );

-- Performance indexes for hire + payments hot paths
CREATE INDEX IF NOT EXISTS idx_hire_applications_job ON public.hire_applications (hire_job_id);
CREATE INDEX IF NOT EXISTS idx_hire_applications_worker ON public.hire_applications (worker_id);
CREATE INDEX IF NOT EXISTS idx_hire_jobs_status_created ON public.hire_jobs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_hire_job ON public.marketplace_messages (hire_job_id);
CREATE INDEX IF NOT EXISTS idx_payments_external_id ON public.payments (external_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);

-- Reduce open anon spam on beta tables (insert still allowed but only via authenticated optional later;
-- keep anon insert for marketing forms but require non-empty email-like check is app-side)
COMMENT ON TABLE public.beta_signups IS 'Anon INSERT allowed for marketing; rate-limit at edge/WAF.';

COMMIT;
