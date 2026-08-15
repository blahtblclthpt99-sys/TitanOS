-- TitanOS 2.0 / 5000X: core tenant ownership integrity
-- RLS controls who may update a row; this trigger controls which ownership
-- fields an authenticated client may mutate once the row exists.

CREATE OR REPLACE FUNCTION public.protect_core_tenant_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.created_by_id := OLD.created_by_id;
    NEW.company_id := OLD.company_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customers_tenant_owner ON public.customers;
CREATE TRIGGER trg_customers_tenant_owner
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.protect_core_tenant_ownership();

DROP TRIGGER IF EXISTS trg_jobs_tenant_owner ON public.jobs;
CREATE TRIGGER trg_jobs_tenant_owner
BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.protect_core_tenant_ownership();

DROP TRIGGER IF EXISTS trg_estimates_tenant_owner ON public.estimates;
CREATE TRIGGER trg_estimates_tenant_owner
BEFORE UPDATE ON public.estimates
FOR EACH ROW EXECUTE FUNCTION public.protect_core_tenant_ownership();

DROP TRIGGER IF EXISTS trg_invoices_tenant_owner ON public.invoices;
CREATE TRIGGER trg_invoices_tenant_owner
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.protect_core_tenant_ownership();
