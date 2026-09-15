-- Titan Autopilot: allow an interrupted run to reclaim its own short delivery reservation.
-- A different run must remain blocked until the existing reservation expires or is released.

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
  v_delivery_key TEXT := BTRIM(COALESCE(p_delivery_key, ''));
BEGIN
  IF p_user_id IS NULL OR p_invoice_id IS NULL OR p_run_id IS NULL OR v_delivery_key = '' THEN
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

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::TEXT || ':' || p_invoice_id::TEXT, 0)
  );

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
    -- Crash-safe idempotent reclaim: the exact same run/delivery key is allowed
    -- to resume its own reservation. A different run stays blocked.
    IF v_guard.run_id = p_run_id AND v_guard.delivery_key = v_delivery_key THEN
      UPDATE public.autopilot_invoice_delivery_guards
      SET reserved_until = v_now + INTERVAL '5 minutes',
          updated_at = v_now
      WHERE user_id = p_user_id
        AND invoice_id = p_invoice_id
        AND run_id = p_run_id
        AND delivery_key = v_delivery_key;

      RETURN QUERY SELECT true, 'reclaimed_same_run'::TEXT, v_now + INTERVAL '5 minutes';
      RETURN;
    END IF;

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
    v_delivery_key,
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

REVOKE ALL ON FUNCTION public.claim_autopilot_invoice_delivery(UUID, UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_autopilot_invoice_delivery(UUID, UUID, UUID, TEXT)
  TO service_role;
