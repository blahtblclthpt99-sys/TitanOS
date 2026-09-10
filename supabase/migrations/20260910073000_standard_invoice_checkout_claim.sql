-- Standard invoice Checkout concurrency + ownership hardening.
--
-- Extends payment authority with a server-owned initiating actor and adds an
-- invoice-row-serialized claim RPC for fee-bearing standard Stripe Checkout.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS initiated_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

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
    NEW.initiated_by_id := NULL;
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
    NEW.initiated_by_id := OLD.initiated_by_id;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_payment_authority ON public.payments;
CREATE TRIGGER trg_protect_payment_authority
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.protect_payment_authority();

CREATE OR REPLACE FUNCTION public.claim_standard_invoice_payment(
  p_invoice_id UUID,
  p_owner_id UUID,
  p_actor_id UUID,
  p_customer_name TEXT,
  p_currency TEXT,
  p_base_amount NUMERIC,
  p_platform_fee NUMERIC,
  p_platform_fee_rate NUMERIC,
  p_amount_total NUMERIC,
  p_note TEXT
)
RETURNS TABLE (
  payment_id UUID,
  reused BOOLEAN,
  base_amount NUMERIC,
  platform_fee NUMERIC,
  platform_fee_rate NUMERIC,
  amount_total NUMERIC,
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
  v_authoritative_base NUMERIC;
  v_stored_balance NUMERIC;
  v_currency TEXT;
BEGIN
  IF p_invoice_id IS NULL OR p_owner_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'standard_checkout_identity_required';
  END IF;

  v_currency := LOWER(COALESCE(NULLIF(BTRIM(p_currency), ''), 'usd'));
  IF v_currency <> 'usd' THEN
    RAISE EXCEPTION 'standard_checkout_currency_not_supported';
  END IF;

  IF p_base_amount IS NULL OR p_base_amount <= 0 OR p_base_amount > 1000000
     OR p_platform_fee IS NULL OR p_platform_fee < 0
     OR p_platform_fee_rate IS NULL OR p_platform_fee_rate < 0
     OR p_amount_total IS NULL OR p_amount_total <= 0 THEN
    RAISE EXCEPTION 'standard_checkout_invalid_terms';
  END IF;
  IF ABS(ROUND((p_base_amount + p_platform_fee)::NUMERIC, 2) - ROUND(p_amount_total::NUMERIC, 2)) > 0.01 THEN
    RAISE EXCEPTION 'standard_checkout_total_mismatch';
  END IF;

  -- Invoice lock is the concurrency boundary for every standard invoice claim.
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'standard_invoice_not_found';
  END IF;
  IF v_invoice.created_by_id IS NULL OR v_invoice.created_by_id IS DISTINCT FROM p_owner_id THEN
    RAISE EXCEPTION 'standard_invoice_owner_mismatch';
  END IF;
  IF LOWER(COALESCE(v_invoice.status, '')) IN ('paid', 'void', 'cancelled', 'refunded') THEN
    RAISE EXCEPTION 'standard_invoice_not_payable';
  END IF;

  v_authoritative_base := ROUND(
    GREATEST(0, COALESCE(v_invoice.total, 0) - COALESCE(v_invoice.amount_paid, 0))::NUMERIC,
    2
  );
  v_stored_balance := ROUND(COALESCE(v_invoice.balance_due, 0)::NUMERIC, 2);

  IF ABS(v_stored_balance - v_authoritative_base) > 0.01 THEN
    RAISE EXCEPTION 'standard_invoice_balance_inconsistent';
  END IF;
  IF v_authoritative_base <= 0 OR v_authoritative_base > 1000000 THEN
    RAISE EXCEPTION 'standard_invoice_invalid_balance';
  END IF;
  IF ABS(v_authoritative_base - ROUND(p_base_amount::NUMERIC, 2)) > 0.01 THEN
    RAISE EXCEPTION 'standard_invoice_amount_changed';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments p
  WHERE p.invoice_id = p_invoice_id
    AND p.provider = 'stripe'
    AND p.status = 'pending'
    AND p.checkout_source = 'standard_invoice'
    AND p.created_by_id = p_owner_id
    AND p.user_id = p_owner_id::TEXT
  ORDER BY p.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF LOWER(COALESCE(v_payment.currency, '')) <> v_currency
       OR ABS(ROUND(COALESCE(v_payment.base_amount, v_payment.amount, 0)::NUMERIC, 2) - ROUND(p_base_amount::NUMERIC, 2)) > 0.01
       OR ABS(ROUND(COALESCE(v_payment.platform_fee, 0)::NUMERIC, 2) - ROUND(p_platform_fee::NUMERIC, 2)) > 0.01
       OR ABS(ROUND(COALESCE(v_payment.platform_fee_rate, 0)::NUMERIC, 6) - ROUND(p_platform_fee_rate::NUMERIC, 6)) > 0.000001
       OR ABS(ROUND(COALESCE(v_payment.amount_total, v_payment.amount, 0)::NUMERIC, 2) - ROUND(p_amount_total::NUMERIC, 2)) > 0.01 THEN
      RAISE EXCEPTION 'standard_checkout_pending_terms_conflict';
    END IF;

    RETURN QUERY
    SELECT
      v_payment.id,
      TRUE,
      v_payment.base_amount,
      v_payment.platform_fee,
      v_payment.platform_fee_rate,
      v_payment.amount_total,
      v_payment.external_id,
      v_payment.checkout_url,
      v_payment.created_at;
    RETURN;
  END IF;

  INSERT INTO public.payments (
    user_id,
    created_by_id,
    initiated_by_id,
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
    p_actor_id,
    p_invoice_id,
    COALESCE(p_customer_name, ''),
    ROUND(p_amount_total::NUMERIC, 2),
    ROUND(p_base_amount::NUMERIC, 2),
    ROUND(p_platform_fee::NUMERIC, 2),
    p_platform_fee_rate,
    ROUND(p_amount_total::NUMERIC, 2),
    v_currency,
    'stripe',
    'pending',
    NULL,
    '',
    COALESCE(NULLIF(p_note, ''), 'TitanOS standard invoice Checkout'),
    'standard_invoice'
  )
  RETURNING * INTO v_payment;

  RETURN QUERY
  SELECT
    v_payment.id,
    FALSE,
    v_payment.base_amount,
    v_payment.platform_fee,
    v_payment.platform_fee_rate,
    v_payment.amount_total,
    v_payment.external_id,
    v_payment.checkout_url,
    v_payment.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_standard_invoice_payment(UUID, UUID, UUID, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_standard_invoice_payment(UUID, UUID, UUID, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.claim_standard_invoice_payment(UUID, UUID, UUID, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_standard_invoice_payment(UUID, UUID, UUID, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) TO service_role;
