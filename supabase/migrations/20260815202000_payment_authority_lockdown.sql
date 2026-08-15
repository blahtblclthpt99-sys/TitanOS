-- TitanOS 2.0 / 5000X: payment-row authority lockdown
-- Service role/admin remain authoritative. Authenticated clients may create a
-- pending draft, but cannot forge settlement/provider metadata afterward.

CREATE OR REPLACE FUNCTION public.protect_payment_authority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.external_id := NULL;
    NEW.checkout_url := NULL;
    NEW.base_amount := NEW.amount;
    NEW.platform_fee := 0;
    NEW.platform_fee_rate := 0;
    NEW.amount_total := NEW.amount;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.created_by_id := OLD.created_by_id;
    NEW.user_id := OLD.user_id;
    NEW.company_id := OLD.company_id;
    NEW.invoice_id := OLD.invoice_id;
    NEW.amount := OLD.amount;
    NEW.currency := OLD.currency;
    NEW.provider := OLD.provider;
    NEW.status := OLD.status;
    NEW.external_id := OLD.external_id;
    NEW.checkout_url := OLD.checkout_url;
    NEW.base_amount := OLD.base_amount;
    NEW.platform_fee := OLD.platform_fee;
    NEW.platform_fee_rate := OLD.platform_fee_rate;
    NEW.amount_total := OLD.amount_total;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_payment_authority ON public.payments;
CREATE TRIGGER trg_protect_payment_authority
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.protect_payment_authority();

-- Financial history is append/update-through-authoritative-lifecycle, not
-- client-deletable. Service role bypasses RLS; admins retain explicit access.
DROP POLICY IF EXISTS payments_delete ON public.payments;
CREATE POLICY payments_delete
ON public.payments
FOR DELETE
TO authenticated
USING (public.is_admin());
