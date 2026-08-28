-- RECOVERY RECONSTRUCTION: this production prerequisite was present in the
-- pre-purge TitanOS database but was not recorded in supabase_migrations or the
-- surviving Git migration chain. Its required schema/policy contract is proven
-- by later authoritative migrations that ALTER the *_company_read/update
-- policies and reference public.is_company_member(text).
--
-- This file exists to make clean recovery deterministic. It must be validated
-- on an isolated database before any future Supabase cutover.

BEGIN;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS company_id text;
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS company_id text;
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS company_id text;
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS company_id text;

CREATE INDEX IF NOT EXISTS idx_customers_company_id
  ON public.customers(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_company_id
  ON public.jobs(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_estimates_company_id
  ON public.estimates(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_company_id
  ON public.invoices(company_id) WHERE company_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_company_owner(target_company_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT target_company_id IS NOT NULL
    AND (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id::text = target_company_id
        AND (
          c.owner_id = (SELECT auth.uid())::text
          OR c.created_by_id = (SELECT auth.uid())
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.is_company_member(target_company_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT target_company_id IS NOT NULL
    AND (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.company_members m
      WHERE m.company_id = target_company_id
        AND m.user_id = (SELECT auth.uid())::text
        AND m.status = 'active'
    );
$$;

REVOKE ALL ON FUNCTION public.is_company_owner(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.is_company_member(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_company_owner(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_member(text) TO authenticated, service_role;

DROP POLICY IF EXISTS customers_company_read ON public.customers;
CREATE POLICY customers_company_read
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    created_by_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR public.is_company_member(company_id)
  );

DROP POLICY IF EXISTS customers_company_update ON public.customers;
CREATE POLICY customers_company_update
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (
    created_by_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR public.is_company_member(company_id)
  )
  WITH CHECK (
    created_by_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR public.is_company_member(company_id)
  );

DROP POLICY IF EXISTS estimates_company_read ON public.estimates;
CREATE POLICY estimates_company_read
  ON public.estimates
  FOR SELECT
  TO authenticated
  USING (
    created_by_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR public.is_company_member(company_id)
  );

DROP POLICY IF EXISTS estimates_company_update ON public.estimates;
CREATE POLICY estimates_company_update
  ON public.estimates
  FOR UPDATE
  TO authenticated
  USING (
    created_by_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR public.is_company_member(company_id)
  )
  WITH CHECK (
    created_by_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR public.is_company_member(company_id)
  );

DROP POLICY IF EXISTS invoices_company_read ON public.invoices;
CREATE POLICY invoices_company_read
  ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    created_by_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR public.is_company_member(company_id)
  );

DROP POLICY IF EXISTS invoices_company_update ON public.invoices;
CREATE POLICY invoices_company_update
  ON public.invoices
  FOR UPDATE
  TO authenticated
  USING (
    created_by_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR public.is_company_member(company_id)
  )
  WITH CHECK (
    created_by_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR public.is_company_member(company_id)
  );

DROP POLICY IF EXISTS jobs_company_read ON public.jobs;
CREATE POLICY jobs_company_read
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (
    created_by_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR public.is_company_member(company_id)
  );

DROP POLICY IF EXISTS jobs_company_update ON public.jobs;
CREATE POLICY jobs_company_update
  ON public.jobs
  FOR UPDATE
  TO authenticated
  USING (
    created_by_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR public.is_company_member(company_id)
  )
  WITH CHECK (
    created_by_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR public.is_company_member(company_id)
  );

COMMENT ON COLUMN public.customers.company_id IS
  'TitanOS tenant context. Recovered prerequisite for pre-purge company RLS.';
COMMENT ON COLUMN public.jobs.company_id IS
  'TitanOS tenant context. Recovered prerequisite for pre-purge company RLS.';
COMMENT ON COLUMN public.estimates.company_id IS
  'TitanOS tenant context. Recovered prerequisite for pre-purge company RLS.';
COMMENT ON COLUMN public.invoices.company_id IS
  'TitanOS tenant context. Recovered prerequisite for pre-purge company RLS.';

COMMIT;
