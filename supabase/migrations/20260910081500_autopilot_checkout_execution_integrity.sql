-- Titan Auto one-time Checkout + execution integrity.
--
-- Removes paid execution authority from mutable payments.note by introducing a
-- server-only order ledger. Adds a deterministic checkout key so concurrent
-- requests share one pending payment identity, and a per-invoice delivery
-- receipt so retries do not depend only on provider memory.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS checkout_key TEXT;

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
    NEW.checkout_key := NULL;
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
    NEW.checkout_key := OLD.checkout_key;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_payment_authority ON public.payments;
CREATE TRIGGER trg_protect_payment_authority
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.protect_payment_authority();

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_autopilot_pending_checkout_key
  ON public.payments (user_id, checkout_source, checkout_key)
  WHERE status = 'pending'
    AND checkout_source = 'titan_auto_sprint'
    AND checkout_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.titan_auto_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkout_key TEXT NOT NULL,
  order_type TEXT NOT NULL DEFAULT 'invoice_recovery_sprint'
    CHECK (order_type IN ('invoice_recovery_sprint')),
  invoice_ids UUID[] NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  state TEXT NOT NULL DEFAULT 'awaiting_payment'
    CHECK (state IN ('awaiting_payment','running','retryable','completed','completed_with_review','cancelled')),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  lease_expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  sent_count INTEGER NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, checkout_key, payment_id)
);

CREATE INDEX IF NOT EXISTS idx_titan_auto_orders_user_state
  ON public.titan_auto_orders (user_id, state, created_at DESC);

ALTER TABLE public.titan_auto_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.titan_auto_orders FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.titan_auto_orders TO service_role;

CREATE TABLE IF NOT EXISTS public.titan_auto_delivery_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.titan_auto_orders(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  queue_id UUID REFERENCES public.follow_up_queue(id) ON DELETE SET NULL,
  recipient_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sending','sent','failed','skipped','needs_review')),
  resend_email_id TEXT,
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_titan_auto_delivery_receipts_order_status
  ON public.titan_auto_delivery_receipts (order_id, status);

ALTER TABLE public.titan_auto_delivery_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.titan_auto_delivery_receipts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.titan_auto_delivery_receipts TO service_role;

CREATE OR REPLACE FUNCTION public.claim_titan_auto_order(
  p_user_id UUID,
  p_checkout_key TEXT,
  p_invoice_ids UUID[],
  p_note TEXT
)
RETURNS TABLE (
  order_id UUID,
  payment_id UUID,
  reused BOOLEAN,
  external_id TEXT,
  checkout_url TEXT,
  claimed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_order public.titan_auto_orders%ROWTYPE;
  v_invoice_count INTEGER;
BEGIN
  IF p_user_id IS NULL
     OR NULLIF(BTRIM(p_checkout_key), '') IS NULL
     OR LENGTH(p_checkout_key) > 160
     OR p_invoice_ids IS NULL THEN
    RAISE EXCEPTION 'autopilot_checkout_identity_required';
  END IF;

  v_invoice_count := COALESCE(array_length(p_invoice_ids, 1), 0);
  IF v_invoice_count < 1 OR v_invoice_count > 10 THEN
    RAISE EXCEPTION 'autopilot_invoice_count_invalid';
  END IF;
  IF (SELECT COUNT(DISTINCT item) FROM unnest(p_invoice_ids) AS item) <> v_invoice_count THEN
    RAISE EXCEPTION 'autopilot_invoice_ids_not_unique';
  END IF;

  -- Serialize the exact authenticated-user + approved-invoice-set claim.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::TEXT || ':' || p_checkout_key, 0)
  );

  SELECT * INTO v_payment
  FROM public.payments p
  WHERE p.user_id = p_user_id::TEXT
    AND p.created_by_id = p_user_id
    AND p.provider = 'stripe'
    AND p.status = 'pending'
    AND p.checkout_source = 'titan_auto_sprint'
    AND p.checkout_key = p_checkout_key
  ORDER BY p.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF LOWER(COALESCE(v_payment.currency, '')) <> 'usd'
       OR ABS(ROUND(COALESCE(v_payment.amount, 0)::NUMERIC, 2) - 9.00) > 0.01
       OR ABS(ROUND(COALESCE(v_payment.base_amount, v_payment.amount, 0)::NUMERIC, 2) - 9.00) > 0.01
       OR ABS(ROUND(COALESCE(v_payment.platform_fee, 0)::NUMERIC, 2)) > 0.01
       OR ABS(ROUND(COALESCE(v_payment.amount_total, v_payment.amount, 0)::NUMERIC, 2) - 9.00) > 0.01 THEN
      RAISE EXCEPTION 'autopilot_pending_payment_terms_conflict';
    END IF;

    SELECT * INTO v_order
    FROM public.titan_auto_orders o
    WHERE o.payment_id = v_payment.id
      AND o.user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'autopilot_pending_order_missing';
    END IF;
    IF v_order.checkout_key IS DISTINCT FROM p_checkout_key
       OR v_order.invoice_ids IS DISTINCT FROM p_invoice_ids
       OR v_order.price_cents <> 900 THEN
      RAISE EXCEPTION 'autopilot_pending_order_mismatch';
    END IF;

    RETURN QUERY SELECT
      v_order.id,
      v_payment.id,
      TRUE,
      v_payment.external_id,
      v_payment.checkout_url,
      v_payment.created_at;
    RETURN;
  END IF;

  INSERT INTO public.payments (
    user_id,
    created_by_id,
    initiated_by_id,
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
    checkout_source,
    checkout_key
  ) VALUES (
    p_user_id::TEXT,
    p_user_id,
    p_user_id,
    9.00,
    9.00,
    0,
    0,
    9.00,
    'usd',
    'stripe',
    'pending',
    NULL,
    '',
    COALESCE(NULLIF(p_note, ''), 'Titan Auto invoice recovery sprint'),
    'titan_auto_sprint',
    p_checkout_key
  )
  RETURNING * INTO v_payment;

  INSERT INTO public.titan_auto_orders (
    payment_id,
    user_id,
    checkout_key,
    order_type,
    invoice_ids,
    price_cents,
    state,
    approved_at
  ) VALUES (
    v_payment.id,
    p_user_id,
    p_checkout_key,
    'invoice_recovery_sprint',
    p_invoice_ids,
    900,
    'awaiting_payment',
    now()
  )
  RETURNING * INTO v_order;

  RETURN QUERY SELECT
    v_order.id,
    v_payment.id,
    FALSE,
    v_payment.external_id,
    v_payment.checkout_url,
    v_payment.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_titan_auto_order(UUID, TEXT, UUID[], TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_titan_auto_order(UUID, TEXT, UUID[], TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.claim_titan_auto_order(UUID, TEXT, UUID[], TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_titan_auto_order(UUID, TEXT, UUID[], TEXT) TO service_role;

COMMENT ON TABLE public.titan_auto_orders IS
  'Server-owned authority for paid Titan Auto execution. payments.note is descriptive only.';
COMMENT ON TABLE public.titan_auto_delivery_receipts IS
  'Per-invoice server delivery state used to make Titan Auto retries auditable and duplicate-resistant.';
