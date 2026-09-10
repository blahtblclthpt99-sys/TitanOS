-- Stripe subscription Checkout integrity.
--
-- Prevents concurrent or repeated website Checkout from creating multiple
-- unresolved subscription Sessions for the same TitanOS user. This table is
-- server-only; browser clients cannot write subscription checkout authority.

CREATE TABLE IF NOT EXISTS public.stripe_subscription_checkout_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_tier TEXT NOT NULL CHECK (plan_tier IN ('starter','worker_premium','business')),
  stripe_customer_id TEXT,
  stripe_session_id TEXT UNIQUE,
  checkout_url TEXT,
  state TEXT NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending','open','completed','expired','failed','requires_review')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_checkout_one_unresolved_per_user
  ON public.stripe_subscription_checkout_claims (user_id)
  WHERE state IN ('pending','open');

CREATE INDEX IF NOT EXISTS idx_subscription_checkout_user_recent
  ON public.stripe_subscription_checkout_claims (user_id, created_at DESC);

ALTER TABLE public.stripe_subscription_checkout_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stripe_subscription_checkout_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.stripe_subscription_checkout_claims TO service_role;

CREATE OR REPLACE FUNCTION public.claim_subscription_checkout(
  p_user_id UUID,
  p_plan_tier TEXT
)
RETURNS TABLE (
  claim_id UUID,
  reused BOOLEAN,
  plan_tier TEXT,
  stripe_customer_id TEXT,
  stripe_session_id TEXT,
  checkout_url TEXT,
  claimed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_claim public.stripe_subscription_checkout_claims%ROWTYPE;
  v_existing_plan TEXT;
  v_customer_id TEXT;
BEGIN
  IF p_user_id IS NULL OR p_plan_tier NOT IN ('starter','worker_premium','business') THEN
    RAISE EXCEPTION 'subscription_checkout_identity_invalid';
  END IF;

  -- One serialized subscription-creation decision per user.
  PERFORM pg_advisory_xact_lock(hashtextextended('subscription:' || p_user_id::TEXT, 0));

  -- Any Stripe subscription that has not reached a terminal state blocks a new
  -- subscription Checkout. Plan changes/recovery must go through billing
  -- management rather than creating another billable subscription.
  SELECT s.plan_tier
  INTO v_existing_plan
  FROM public.stripe_subscriptions s
  WHERE s.user_id = p_user_id
    AND LOWER(COALESCE(s.status, '')) NOT IN ('canceled','incomplete_expired')
  ORDER BY s.updated_at DESC
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'subscription_existing_nonterminal:%', v_existing_plan;
  END IF;

  SELECT * INTO v_claim
  FROM public.stripe_subscription_checkout_claims c
  WHERE c.user_id = p_user_id
    AND c.state IN ('pending','open')
  ORDER BY c.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_claim.plan_tier IS DISTINCT FROM p_plan_tier THEN
      RAISE EXCEPTION 'subscription_checkout_plan_conflict';
    END IF;

    RETURN QUERY SELECT
      v_claim.id,
      TRUE,
      v_claim.plan_tier,
      v_claim.stripe_customer_id,
      v_claim.stripe_session_id,
      v_claim.checkout_url,
      v_claim.claimed_at;
    RETURN;
  END IF;

  -- Reuse the most recently observed Stripe customer identity when the user
  -- previously subscribed. This keeps billing history on one Stripe customer.
  SELECT s.stripe_customer_id
  INTO v_customer_id
  FROM public.stripe_subscriptions s
  WHERE s.user_id = p_user_id
    AND NULLIF(BTRIM(s.stripe_customer_id), '') IS NOT NULL
  ORDER BY s.updated_at DESC
  LIMIT 1;

  INSERT INTO public.stripe_subscription_checkout_claims (
    user_id,
    plan_tier,
    stripe_customer_id,
    state,
    claimed_at
  ) VALUES (
    p_user_id,
    p_plan_tier,
    v_customer_id,
    'pending',
    now()
  )
  RETURNING * INTO v_claim;

  RETURN QUERY SELECT
    v_claim.id,
    FALSE,
    v_claim.plan_tier,
    v_claim.stripe_customer_id,
    v_claim.stripe_session_id,
    v_claim.checkout_url,
    v_claim.claimed_at;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_subscription_checkout(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_subscription_checkout(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.claim_subscription_checkout(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_subscription_checkout(UUID, TEXT) TO service_role;

COMMENT ON TABLE public.stripe_subscription_checkout_claims IS
  'Server-owned Stripe subscription Checkout lifecycle. One unresolved Checkout per user.';
