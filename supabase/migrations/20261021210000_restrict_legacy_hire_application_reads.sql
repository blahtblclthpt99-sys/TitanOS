-- Tighten legacy hiring application visibility in databases that already ran 002.
-- This does not create missing hiring tables and must be reviewed before deployment.
DO $$
BEGIN
  IF to_regclass('public.hire_applications') IS NULL
     OR to_regclass('public.hire_jobs') IS NULL THEN
    RAISE NOTICE 'Legacy hiring tables absent; skipping application policy repair';
    RETURN;
  END IF;

  IF to_regprocedure('public.is_admin()') IS NULL THEN
    RAISE EXCEPTION 'Cannot repair hiring RLS: public.is_admin() is missing';
  END IF;

  DROP POLICY IF EXISTS hire_apps_write ON public.hire_applications;
  CREATE POLICY hire_apps_write ON public.hire_applications
    FOR INSERT TO authenticated
    WITH CHECK ((created_by_id = auth.uid() AND status = 'pending') OR public.is_admin());

  DROP POLICY IF EXISTS hire_apps_read ON public.hire_applications;
  CREATE POLICY hire_apps_read ON public.hire_applications
    FOR SELECT TO authenticated
    USING (
      created_by_id = auth.uid()
      OR public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.hire_jobs AS job
        WHERE job.id::text = hire_applications.hire_job_id
          AND job.created_by_id = auth.uid()
      )
    );
END $$;
