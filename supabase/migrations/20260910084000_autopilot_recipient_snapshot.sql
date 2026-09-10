-- Titan Auto approved-recipient snapshot.
-- Execution sends only to the invoice -> email mapping captured when the user
-- approved the one-time sprint Checkout.

ALTER TABLE public.titan_auto_orders
  ADD COLUMN IF NOT EXISTS approved_recipients JSONB NOT NULL DEFAULT '{}'::jsonb;

DROP FUNCTION IF EXISTS public.claim_titan_auto_order(UUID, TEXT, UUID[], TEXT);

CREATE OR REPLACE FUNCTION public.claim_titan_auto_order(
  p_user_id UUID,
  p_checkout_key TEXT,
  p_invoice_ids UUID[],
  p_approved_recipients JSONB,
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
  v_invoice_id UUID;
  v_email TEXT;
BEGIN
  IF p_user_id IS NULL
     OR NULLIF(BTRIM(p_checkout_key), '') IS NULL
     OR LENGTH(p_checkout_key) > 160
     OR p_invoice_ids IS NULL
     OR jsonb_typeof(p_approved_recipients) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'autopilot_checkout_identity_required';
  END IF;

  v_invoice_count := COALESCE(array_length(p_invoice_ids, 1), 0);
  IF v_invoice_count < 1 OR v_invoice_count > 10 THEN
    RAISE EXCEPTION 'autopilot_invoice_count_invalid';
  END IF;
  IF (SELECT COUNT(DISTINCT item) FROM unnest(p_invoice_ids) AS item) <> v_invoice_count THEN
    RAISE EXCEPTION 'autopilot_invoice_ids_not_unique';
  END IF;
  IF (SELECT COUNT(*) FROM jsonb_object_keys(p_approved_recipients)) <> v_invoice_count THEN
    RAISE EXCEPTION 'autopilot_recipient_count_mismatch';
  END IF;

  FOREACH v_invoice_id IN ARRAY p_invoice_ids LOOP
    v_email := NULLIF(BTRIM(p_approved_recipients ->> v_invoice_id::TEXT), '');
    IF v_email IS NULL OR LENGTH(v_email) > 320 THEN
      RAISE EXCEPTION 'autopilot_recipient_missing';
    END IF;
  END LOOP;

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
       OR v_order.approved_recipients IS DISTINCT FROM p_approved_recipients
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
    approved_recipients,
    price_cents,
    state,
    approved_at
  ) VALUES (
    v_payment.id,
    p_user_id,
    p_checkout_key,
    'invoice_recovery_sprint',
    p_invoice_ids,
    p_approved_recipients,
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

REVOKE ALL ON FUNCTION public.claim_titan_auto_order(UUID, TEXT, UUID[], JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_titan_auto_order(UUID, TEXT, UUID[], JSONB, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.claim_titan_auto_order(UUID, TEXT, UUID[], JSONB, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_titan_auto_order(UUID, TEXT, UUID[], JSONB, TEXT) TO service_role;
