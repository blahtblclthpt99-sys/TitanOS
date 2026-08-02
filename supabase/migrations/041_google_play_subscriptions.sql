-- Google Play subscription receipts are server-only. No client role may read or write tokens.
CREATE TABLE IF NOT EXISTS public.google_play_subscriptions (
  purchase_token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text NOT NULL CHECK (product_id IN ('titanos_starter_monthly','titanos_pro_monthly','titanos_business_monthly')),
  base_plan_id text,
  subscription_state text NOT NULL,
  expires_at timestamptz,
  auto_renewing boolean NOT NULL DEFAULT false,
  acknowledged boolean NOT NULL DEFAULT false,
  linked_purchase_token text,
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS google_play_subscriptions_user_idx ON public.google_play_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS google_play_subscriptions_state_expiry_idx ON public.google_play_subscriptions(subscription_state, expires_at);
ALTER TABLE public.google_play_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_play_subscriptions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.google_play_subscriptions TO service_role;

DROP TRIGGER IF EXISTS google_play_subscriptions_set_updated_at ON public.google_play_subscriptions;
CREATE TRIGGER google_play_subscriptions_set_updated_at
BEFORE UPDATE ON public.google_play_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
