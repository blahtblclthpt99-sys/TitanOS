-- Phase 2A: tighten hire_applications RLS (owner + applicant + admin only).
--
-- SAFETY: This migration does NOT drop tables, truncate data, or delete rows.
-- `DROP POLICY` only removes Postgres access rules so they can be replaced.
-- Existing hire_applications / hire_jobs rows are unchanged.
--
-- Effect: authenticated users can no longer SELECT every application
-- (old policy was USING (true)). After apply, only the applicant, the job
-- owner, or an admin can read/update applications.

BEGIN;

-- Remove prior policy names (no-op if a name was never created).
DROP POLICY IF EXISTS hire_apps_read ON public.hire_applications;
DROP POLICY IF EXISTS hire_apps_write ON public.hire_applications;
DROP POLICY IF EXISTS hire_apps_select ON public.hire_applications;
DROP POLICY IF EXISTS hire_apps_insert ON public.hire_applications;
DROP POLICY IF EXISTS hire_apps_update ON public.hire_applications;
DROP POLICY IF EXISTS hire_apps_delete ON public.hire_applications;

CREATE POLICY hire_apps_select ON public.hire_applications
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR created_by_id = auth.uid()
    OR worker_id = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.hire_jobs j
      WHERE j.id::text = hire_applications.hire_job_id
        AND (
          j.created_by_id = auth.uid()
          OR j.customer_id = auth.uid()::text
        )
    )
  );

CREATE POLICY hire_apps_insert ON public.hire_applications
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by_id = auth.uid()
    AND worker_id = auth.uid()::text
  );

-- Applicant may withdraw; job owner (or admin) may accept/reject.
CREATE POLICY hire_apps_update ON public.hire_applications
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR created_by_id = auth.uid()
    OR worker_id = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.hire_jobs j
      WHERE j.id::text = hire_applications.hire_job_id
        AND (
          j.created_by_id = auth.uid()
          OR j.customer_id = auth.uid()::text
        )
    )
  )
  WITH CHECK (
    public.is_admin()
    OR created_by_id = auth.uid()
    OR worker_id = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.hire_jobs j
      WHERE j.id::text = hire_applications.hire_job_id
        AND (
          j.created_by_id = auth.uid()
          OR j.customer_id = auth.uid()::text
        )
    )
  );

CREATE POLICY hire_apps_delete ON public.hire_applications
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR created_by_id = auth.uid()
  );

COMMIT;
