-- Titan Autopilot: atomic owner+invoice send reservation.
-- Free access must not allow two concurrent *new* sprints to race past the
-- repeat-reminder check and contact the same invoice twice.

CREATE TABLE IF NOT EXISTS public.autopilot_invoice_delivery_guards (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  run_id UUID NOT NULL,
  delivery_key TEXT NOT NULL,
  reserved_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, invoice_id)
);

ALTER TABLE public.autopilot_invoice_delivery_guards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.autopilot_invoice_delivery_guards FROM anon, authenticated;
DROP POLICY IF EXISTS autopilot_invoice_delivery_guards_no_client
  ON public.autopilot_invoice_delivery_guards;
CREATE POLICY autopilot_invoice_delivery_guards_no_client
  ON public.autopilot_invoice_delivery_guards
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.autopilot_invoice_delivery_guards IS
  'Short service-only owner+invoice reservations that serialize new Autopilot delivery creation. Pending/sent Recovery Receipts remain the long-lived delivery truth.';

CREATE OR REPLACE FUNCTION public.claim_autopilot_invoice_delivery(
  p_user_id UUID,
  p_invoice_id UUID,
  p_run_id UUID,
  p_delivery_key TEXT
)
RETURNS TABLE(claimed BOOLEAN, reason TEXT, blocked_until TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_recent_sent TIMESTAMPTZ;
  v_pending_created TIMESTAMPTZ;
  v_guard public.autopilot_invoice_delivery_guards%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_invoice_id IS NULL OR p_run_id IS NULL OR NULLIF(BTRIM(p_delivery_key), '') IS NULL THEN
    RETURN QUERY SELECT false, 'invalid_request'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.invoices AS i
    WHERE i.id = p_invoice_id
      AND i.created_by_id = p_user_id
  ) THEN
    RETURN QUERY SELECT false, 'invoice_unavailable'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Serialize every new-delivery claim for this exact owner + invoice, even
  -- before a guard row exists. This closes the check-then-send race.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::TEXT || ':' || p_invoice_id::TEXT, 0)
  );

  -- Recovery Receipts are authoritative across historical order/membership
  -- runs and current free runs because every key ends with :<invoice UUID>.
  SELECT MAX(q.sent_at)
    INTO v_recent_sent
  FROM public.follow_up_queue AS q
  WHERE q.created_by_id = p_user_id
    AND q.status = 'sent'
    AND q.sent_at >= v_now - INTERVAL '72 hours'
    AND q.rule_id LIKE ('autopilot_run:%:' || p_invoice_id::TEXT);

  IF v_recent_sent IS NOT NULL THEN
    RETURN QUERY SELECT false, 'recent_sent'::TEXT, v_recent_sent + INTERVAL '72 hours';
    RETURN;
  END IF;

  -- An ambiguous/in-flight delivery must block a different new run while its
  -- provider idempotency key is still safely retryable.
  SELECT MAX(q.created_at)
    INTO v_pending_created
  FROM public.follow_up_queue AS q
  WHERE q.created_by_id = p_user_id
    AND q.status = 'pending'
    AND q.created_at >= v_now - INTERVAL '23 hours'
    AND q.rule_id LIKE ('autopilot_run:%:' || p_invoice_id::TEXT);

  IF v_pending_created IS NOT NULL THEN
    RETURN QUERY SELECT false, 'pending_delivery'::TEXT, v_pending_created + INTERVAL '23 hours';
    RETURN;
  END IF;

  SELECT *
    INTO v_guard
  FROM public.autopilot_invoice_delivery_guards
  WHERE user_id = p_user_id
    AND invoice_id = p_invoice_id
  FOR UPDATE;

  IF FOUND AND v_guard.reserved_until > v_now THEN
    RETURN QUERY SELECT false, 'active_reservation'::TEXT, v_guard.reserved_until;
    RETURN;
  END IF;

  INSERT INTO public.autopilot_invoice_delivery_guards (
    user_id,
    invoice_id,
    run_id,
    delivery_key,
    reserved_until,
    updated_at
  ) VALUES (
    p_user_id,
    p_invoice_id,
    p_run_id,
    p_delivery_key,
    v_now + INTERVAL '5 minutes',
    v_now
  )
  ON CONFLICT (user_id, invoice_id) DO UPDATE SET
    run_id = EXCLUDED.run_id,
    delivery_key = EXCLUDED.delivery_key,
    reserved_until = EXCLUDED.reserved_until,
    updated_at = EXCLUDED.updated_at;

  RETURN QUERY SELECT true, 'claimed'::TEXT, v_now + INTERVAL '5 minutes';
END;
$$;

CREATE OR REPLACE FUNCTION public.release_autopilot_invoice_delivery(
  p_user_id UUID,
  p_invoice_id UUID,
  p_run_id UUID,
  p_delivery_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  DELETE FROM public.autopilot_invoice_delivery_guards
  WHERE user_id = p_user_id
    AND invoice_id = p_invoice_id
    AND run_id = p_run_id
    AND delivery_key = p_delivery_key;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_autopilot_invoice_delivery(UUID, UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_autopilot_invoice_delivery(UUID, UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_autopilot_invoice_delivery(UUID, UUID, UUID, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_autopilot_invoice_delivery(UUID, UUID, UUID, TEXT)
  TO service_role;
