-- Stripe refund reconciliation ledger.
--
-- Additive only. This migration does not replay historical migrations or mutate
-- legacy refund state. It gives the verified Stripe webhook an atomic path to
-- record cumulative refunds and, only when the refunded invoice principal is
-- known exactly, reconcile the linked invoice in the same transaction.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_base_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_updated_at TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE public.payments
    ADD CONSTRAINT payments_refunded_amount_nonnegative
    CHECK (refunded_amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.payments
    ADD CONSTRAINT payments_refunded_base_amount_nonnegative
    CHECK (refunded_base_amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.reconcile_stripe_refund(
  p_payment_id UUID,
  p_invoice_id UUID,
  p_expected_owner UUID,
  p_currency TEXT,
  p_charge_amount NUMERIC,
  p_refunded_amount NUMERIC,
  p_refunded_base_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_invoice public.invoices%ROWTYPE;
  v_payment_total NUMERIC;
  v_payment_base NUMERIC;
  v_current_refunded NUMERIC;
  v_current_base_refunded NUMERIC;
  v_target_refunded NUMERIC;
  v_target_base_refunded NUMERIC;
  v_refund_delta NUMERIC;
  v_base_refund_delta NUMERIC;
  v_was_settled BOOLEAN;
  v_invoice_id UUID;
  v_invoice_total NUMERIC;
  v_previous_paid NUMERIC;
  v_paid_delta NUMERIC;
  v_new_paid NUMERIC;
  v_new_balance NUMERIC;
  v_new_invoice_status TEXT;
  v_new_payment_status TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_payment_id IS NULL THEN
    RAISE EXCEPTION 'payment_id_required';
  END IF;
  IF p_charge_amount IS NULL OR p_charge_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_charge_amount';
  END IF;
  IF p_refunded_amount IS NULL OR p_refunded_amount < 0 OR p_refunded_amount > p_charge_amount + 0.01 THEN
    RAISE EXCEPTION 'invalid_refunded_amount';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found';
  END IF;

  IF p_expected_owner IS NOT NULL
     AND COALESCE(v_payment.created_by_id, v_payment.user_id) IS NOT NULL
     AND v_payment.created_by_id IS DISTINCT FROM p_expected_owner
     AND v_payment.user_id IS DISTINCT FROM p_expected_owner THEN
    RAISE EXCEPTION 'payment_owner_mismatch';
  END IF;

  v_invoice_id := COALESCE(v_payment.invoice_id, p_invoice_id);
  IF p_invoice_id IS NOT NULL AND v_payment.invoice_id IS NOT NULL AND v_payment.invoice_id <> p_invoice_id THEN
    RAISE EXCEPTION 'payment_invoice_mismatch';
  END IF;

  IF p_currency IS NOT NULL
     AND v_payment.currency IS NOT NULL
     AND LOWER(v_payment.currency) <> LOWER(p_currency) THEN
    RAISE EXCEPTION 'payment_currency_mismatch';
  END IF;

  v_payment_total := ROUND(COALESCE(v_payment.amount_total, v_payment.amount, 0)::NUMERIC, 2);
  v_payment_base := ROUND(COALESCE(v_payment.base_amount, v_payment.amount, 0)::NUMERIC, 2);

  IF v_payment_total <= 0 OR ABS(v_payment_total - ROUND(p_charge_amount::NUMERIC, 2)) > 0.01 THEN
    RAISE EXCEPTION 'payment_charge_amount_mismatch';
  END IF;
  IF v_payment_base < 0 OR v_payment_base > v_payment_total + 0.01 THEN
    RAISE EXCEPTION 'invalid_payment_base_amount';
  END IF;

  v_current_refunded := ROUND(COALESCE(v_payment.refunded_amount, 0)::NUMERIC, 2);
  v_current_base_refunded := ROUND(COALESCE(v_payment.refunded_base_amount, 0)::NUMERIC, 2);
  IF v_current_refunded < 0 OR v_current_refunded > v_payment_total + 0.01 THEN
    RAISE EXCEPTION 'invalid_stored_refunded_amount';
  END IF;
  IF v_current_base_refunded < 0 OR v_current_base_refunded > v_payment_base + 0.01 THEN
    RAISE EXCEPTION 'invalid_stored_refunded_base_amount';
  END IF;

  -- Stripe Charge.amount_refunded is cumulative. Never move the ledger backward
  -- if Stripe delivers refund events out of order.
  v_target_refunded := GREATEST(v_current_refunded, LEAST(v_payment_total, ROUND(p_refunded_amount::NUMERIC, 2)));
  v_refund_delta := GREATEST(0, v_target_refunded - v_current_refunded);

  IF p_refunded_base_amount IS NULL THEN
    -- A partial refund of a fee-bearing Checkout charge has no line-item
    -- allocation in Stripe. Keep invoice principal unchanged until policy or
    -- explicit allocation makes the amount authoritative.
    v_target_base_refunded := v_current_base_refunded;
  ELSE
    IF p_refunded_base_amount < 0 OR p_refunded_base_amount > v_payment_base + 0.01 THEN
      RAISE EXCEPTION 'invalid_refunded_base_amount';
    END IF;
    v_target_base_refunded := GREATEST(
      v_current_base_refunded,
      LEAST(v_payment_base, ROUND(p_refunded_base_amount::NUMERIC, 2))
    );
  END IF;

  IF v_target_base_refunded > v_target_refunded + 0.01 THEN
    RAISE EXCEPTION 'base_refund_exceeds_total_refund';
  END IF;

  v_base_refund_delta := GREATEST(0, v_target_base_refunded - v_current_base_refunded);
  v_was_settled := v_payment.status IN ('succeeded', 'refunded');
  v_new_payment_status := CASE
    WHEN v_target_refunded + 0.01 >= v_payment_total THEN 'refunded'
    ELSE 'succeeded'
  END;

  -- When the invoice-principal refund is authoritative, reconcile invoice and
  -- payment under the same PostgreSQL transaction and row locks.
  IF v_invoice_id IS NOT NULL AND p_refunded_base_amount IS NOT NULL THEN
    SELECT * INTO v_invoice
    FROM public.invoices
    WHERE id = v_invoice_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'invoice_not_found';
    END IF;
    IF p_expected_owner IS NOT NULL
       AND v_invoice.created_by_id IS NOT NULL
       AND v_invoice.created_by_id <> p_expected_owner THEN
      RAISE EXCEPTION 'invoice_owner_mismatch';
    END IF;

    v_invoice_total := ROUND(COALESCE(v_invoice.total, 0)::NUMERIC, 2);
    v_previous_paid := ROUND(COALESCE(v_invoice.amount_paid, 0)::NUMERIC, 2);

    -- If refund arrives before checkout.session.completed, the verified Charge
    -- proves the payment was captured. Credit its net principal once. If the
    -- payment had already settled, subtract only the newly refunded principal.
    v_paid_delta := CASE
      WHEN v_was_settled THEN -v_base_refund_delta
      ELSE v_payment_base - v_target_base_refunded
    END;

    v_new_paid := GREATEST(0, LEAST(v_invoice_total, v_previous_paid + v_paid_delta));
    v_new_balance := GREATEST(0, v_invoice_total - v_new_paid);
    v_new_invoice_status := CASE
      WHEN v_new_balance <= 0.01 THEN 'paid'
      WHEN v_new_paid > 0.01 THEN 'partial'
      ELSE 'sent'
    END;

    UPDATE public.invoices
    SET status = v_new_invoice_status,
        amount_paid = v_new_paid,
        balance_due = v_new_balance,
        paid_at = CASE WHEN v_new_invoice_status = 'paid' THEN COALESCE(paid_at, v_now) ELSE NULL END,
        updated_at = v_now
    WHERE id = v_invoice_id;
  END IF;

  UPDATE public.payments
  SET status = v_new_payment_status,
      refunded_amount = v_target_refunded,
      refunded_base_amount = v_target_base_refunded,
      refund_updated_at = CASE WHEN v_refund_delta > 0 THEN v_now ELSE refund_updated_at END,
      note = CASE
        WHEN v_refund_delta > 0 THEN CONCAT_WS(
          ' · ',
          NULLIF(note, ''),
          'Stripe refund reconciled: $' || TO_CHAR(v_target_refunded, 'FM9999999990.00') || ' cumulative'
        )
        ELSE note
      END,
      updated_at = v_now
  WHERE id = p_payment_id;

  RETURN jsonb_build_object(
    'payment_id', p_payment_id,
    'invoice_id', v_invoice_id,
    'payment_status', v_new_payment_status,
    'refunded_amount', v_target_refunded,
    'refund_delta', v_refund_delta,
    'refunded_base_amount', v_target_base_refunded,
    'base_refund_delta', v_base_refund_delta,
    'invoice_reconciled', v_invoice_id IS NOT NULL AND p_refunded_base_amount IS NOT NULL
  );
END;
$$;

-- Financial reconciliation is server-only. The service-role webhook invokes
-- this function; browser roles cannot call it directly.
REVOKE ALL ON FUNCTION public.reconcile_stripe_refund(UUID, UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_stripe_refund(UUID, UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC) FROM anon;
REVOKE ALL ON FUNCTION public.reconcile_stripe_refund(UUID, UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_stripe_refund(UUID, UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC) TO service_role;
