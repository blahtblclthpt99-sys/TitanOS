-- 021: Privilege + money integrity — block client escalation of role/plan and client invoice paid
-- SAFETY: Trigger-based; service_role and is_admin() can still set privileged fields / paid status.

BEGIN;

-- ---------------------------------------------------------------------------
-- Profiles: non-admins cannot change privilege / billing entitlement columns
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND COALESCE(auth.role(), '') <> 'service_role' AND NOT public.is_admin() THEN
    NEW.role := OLD.role;
    NEW.is_pro := OLD.is_pro;
    NEW.lifetime_premium := OLD.lifetime_premium;
    IF OLD.paying_subscriber IS NOT NULL THEN
      NEW.paying_subscriber := OLD.paying_subscriber;
    END IF;
    NEW.plan_tier := OLD.plan_tier;
    -- account_type only lock after first set (signup may set once)
    IF OLD.account_type IS NOT NULL AND btrim(OLD.account_type) <> '' THEN
      NEW.account_type := OLD.account_type;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileges();

-- ---------------------------------------------------------------------------
-- Invoices: status=paid only via service_role or admin (Stripe webhook path)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_invoice_paid_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status IS NOT DISTINCT FROM 'paid'
     AND OLD.status IS DISTINCT FROM 'paid'
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Invoice paid status may only be set by payment webhook or admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_invoice_paid ON public.invoices;
CREATE TRIGGER trg_protect_invoice_paid
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_invoice_paid_status();

-- ---------------------------------------------------------------------------
-- Messages: recipients may only touch read_at (body stays sender-owned)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_message_body()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin()
     AND NEW.sender_id IS DISTINCT FROM auth.uid()::text
     AND NEW.created_by_id IS DISTINCT FROM auth.uid() THEN
    -- Recipient (or other participant): preserve content fields
    NEW.body := OLD.body;
    NEW.sender_id := OLD.sender_id;
    NEW.recipient_id := OLD.recipient_id;
    NEW.hire_job_id := OLD.hire_job_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_message_body ON public.marketplace_messages;
CREATE TRIGGER trg_protect_message_body
  BEFORE UPDATE ON public.marketplace_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_message_body();

COMMIT;
