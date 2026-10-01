-- Titan Auto execution lease + legacy note freeze.
--
-- Existing pre-ledger AUTOPILOT notes become immutable to browser clients once
-- this migration lands. New paid execution uses titan_auto_orders instead.

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

    -- Legacy paid Titan Auto orders stored execution data in note. Freeze those
    -- notes so browser clients cannot change approved invoice IDs or state.
    IF OLD.checkout_source IS NOT DISTINCT FROM 'titan_auto_sprint'
       OR COALESCE(OLD.note, '') LIKE 'AUTOPILOT:%' THEN
      NEW.note := OLD.note;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_payment_authority ON public.payments;
CREATE TRIGGER trg_protect_payment_authority
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.protect_payment_authority();

CREATE OR REPLACE FUNCTION public.claim_titan_auto_execution(
  p_payment_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  order_id UUID,
  invoice_ids UUID[],
  prior_state TEXT,
  lease_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_order public.titan_auto_orders%ROWTYPE;
  v_prior_state TEXT;
  v_now TIMESTAMPTZ := now();
  v_lease TIMESTAMPTZ := now() + interval '15 minutes';
BEGIN
  IF p_payment_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'autopilot_execution_identity_required';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_payment.user_id IS DISTINCT FROM p_user_id::TEXT
     OR v_payment.created_by_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'autopilot_order_not_found';
  END IF;
  IF v_payment.status IS DISTINCT FROM 'succeeded' THEN
    RAISE EXCEPTION 'autopilot_payment_not_settled';
  END IF;

  SELECT * INTO v_order
  FROM public.titan_auto_orders
  WHERE payment_id = p_payment_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'autopilot_order_ledger_missing';
  END IF;

  v_prior_state := v_order.state;
  IF v_order.state IN ('completed', 'completed_with_review') THEN
    RAISE EXCEPTION 'autopilot_order_already_completed';
  END IF;
  IF v_order.state = 'cancelled' THEN
    RAISE EXCEPTION 'autopilot_order_cancelled';
  END IF;
  IF v_order.state = 'running'
     AND v_order.lease_expires_at IS NOT NULL
     AND v_order.lease_expires_at > v_now THEN
    RAISE EXCEPTION 'autopilot_order_already_running';
  END IF;
  IF v_order.state NOT IN ('awaiting_payment', 'retryable', 'running') THEN
    RAISE EXCEPTION 'autopilot_order_state_invalid';
  END IF;

  UPDATE public.titan_auto_orders
  SET state = 'running',
      started_at = v_now,
      lease_expires_at = v_lease,
      completed_at = NULL,
      last_error = NULL,
      updated_at = v_now
  WHERE id = v_order.id;

  RETURN QUERY SELECT v_order.id, v_order.invoice_ids, v_prior_state, v_lease;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_titan_auto_execution(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_titan_auto_execution(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.claim_titan_auto_execution(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_titan_auto_execution(UUID, UUID) TO service_role;
