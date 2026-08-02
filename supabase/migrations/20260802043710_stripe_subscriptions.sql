BEGIN;

CREATE TABLE IF NOT EXISTS public.stripe_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_price_id text NOT NULL,
  plan_tier text NOT NULL CHECK (plan_tier IN ('starter', 'worker_premium', 'business')),
  status text NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stripe_subscriptions_user_idx
  ON public.stripe_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS stripe_subscriptions_customer_idx
  ON public.stripe_subscriptions (stripe_customer_id);
CREATE INDEX IF NOT EXISTS stripe_subscriptions_status_idx
  ON public.stripe_subscriptions (status, current_period_end);

ALTER TABLE public.stripe_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stripe_subscriptions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.stripe_subscriptions TO service_role;

COMMENT ON TABLE public.stripe_subscriptions IS
  'Server-managed Stripe subscription state. Never writable by browser clients.';

COMMIT;
