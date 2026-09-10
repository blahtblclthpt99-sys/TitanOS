-- Payment refund authority + portal checkout concurrency hardening.
--
-- Additive/current migration only. Extends the existing payment authority
-- trigger to cover the newer refund ledger and a server-owned checkout source,
-- then adds a service-role-only claim RPC that serializes portal checkout
-- creation on the invoice row.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS checkout_source TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_pending_invoice_checkout
  ON public.payments (invoice_id, provider, status, checkout_source, created_at DESC)
  WHERE status = 'pending';

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
    NEW.refunded_amount := 0;
    NEW.refunded_base_amount := 0;
    NEW.refund_updated_at := NULL;
    NEW.checkout_source := NULL;
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
    NEW.refunded_amount := OLD.refunded_amount;
    NEW.refunded_base_amount := OLD.refunded_base_amount;
    NEW.refund_updated_at := OLD.refund_updated_at;
    NEW.checkout_source := OLD.checkout_source;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_payment_authority ON public.payments;
CREATE TRIGGER trg_protect_payment_authority
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.protect_payment_authority();

CREATE OR REPLACE FUNCTION public.claim_portal_invoice_payment(
  p_invoice_id UUID,
  p_owner_id UUID,
  p_customer_id TEXT,
  p_customer_name TEXT DEFAULT '',
  p_currency TEXT DEFAULT 'usd'
)
RETURNS TABLE (
  payment_id UUID,
  reused BOOLEAN,
  amount NUMERIC,
  external_id TEXT,
  checkout_url TEXT,
  claimed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_amount NUMERIC;
  v_stored_balance NUMERIC;
  v_currency TEXT;
BEGIN
  IF p_invoice_id IS NULL OR p_owner_id IS NULL OR NULLIF(BTRIM(p_customer_id), '') IS NULL THEN
    RAISE EXCEPTION 'portal_checkout_identity_required';
  END IF;

  v_currency := LOWER(COALESCE(NULLIF(BTRIM(p_currency), ''), 'usd'));
  IF v_currency <> 'usd' THEN
    RAISE EXCEPTION 'portal_checkout_currency_not_supported';
  END IF;

  -- The invoice row lock is the concurrency boundary. It serializes concurrent
  -- portal claims and also coordinates with webhook updates to this invoice.
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'portal_invoice_not_found';
  END IF;
  IF v_invoice.created_by_id IS DISTINCT FROM p_owner_id
     OR v_invoice.customer_id IS DISTINCT FROM p_customer_id THEN
    RAISE EXCEPTION 'portal_invoice_ownership_mismatch';
  END IF;
  IF LOWER(COALESCE(v_invoice.status, '')) IN ('paid', 'void', 'cancelled', 'refunded') THEN
    RAISE EXCEPTION 'portal_invoice_not_payable';
  END IF;

  -- Payable principal is derived from accounting state, not from a nullable or
  -- stale UI field. If the stored balance disagrees, fail closed rather than
  -- risk over/under-charging a customer.
  v_amount := ROUND(GREATEST(0, COALESCE(v_invoice.total, 0) - COALESCE(v_invoice.amount_paid, 0))::NUMERIC, 2);
  v_stored_balance := ROUND(COALESCE(v_invoice.balance_due, 0)::NUMERIC, 2);
  IF ABS(v_stored_balance - v_amount) > 0.01 THEN
    RAISE EXCEPTION 'portal_invoice_balance_inconsistent';
  END IF;
  IF v_amount <= 0 OR v_amount > 1000000 THEN
    RAISE EXCEPTION 'portal_invoice_invalid_balance';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments p
  WHERE p.invoice_id = p_invoice_id
    AND p.provider = 'stripe'
    AND p.status = 'pending'
    AND p.checkout_source = 'portal'
    AND p.created_by_id = p_owner_id
    AND p.user_id = p_owner_id::TEXT
  ORDER BY p.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF LOWER(COALESCE(v_payment.currency, '')) <> v_currency
       OR ABS(ROUND(COALESCE(v_payment.amount_total, v_payment.amount, 0)::NUMERIC, 2) - v_amount) > 0.01
       OR ABS(ROUND(COALESCE(v_payment.base_amount, v_payment.amount, 0)::NUMERIC, 2) - v_amount) > 0.01
       OR ABS(ROUND(COALESCE(v_payment.platform_fee, 0)::NUMERIC, 2)) > 0.01 THEN
      -- Never silently create a second session while another pending portal
      -- payment exists with conflicting financial terms.
      RAISE EXCEPTION 'portal_checkout_pending_amount_conflict';
    END IF;

    RETURN QUERY
    SELECT v_payment.id, TRUE, v_amount, v_payment.external_id, v_payment.checkout_url, v_payment.created_at;
    RETURN;
  END IF;

  INSERT INTO public.payments (
    user_id,
    created_by_id,
    invoice_id,
    customer_name,
    amount,
    base_amount,
    platform_fee,
    platform_fee_rate,
    amount_total,
    currency,
    provider,
    status,
    external_id,
    checkout_url,
    note,
    checkout_source
  ) VALUES (
    p_owner_id::TEXT,
    p_owner_id,
    p_invoice_id,
    COALESCE(p_customer_name, ''),
    v_amount,
    v_amount,
    0,
    0,
    v_amount,
    v_currency,
    'stripe',
    'pending',
    NULL,
    '',
    'Customer portal invoice payment (no TitanOS platform fee).',
    'portal'
  )
  RETURNING * INTO v_payment;

  RETURN QUERY
  SELECT v_payment.id, FALSE, v_amount, v_payment.external_id, v_payment.checkout_url, v_payment.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_portal_invoice_payment(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_portal_invoice_payment(UUID, UUID, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.claim_portal_invoice_payment(UUID, UUID, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_portal_invoice_payment(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;
