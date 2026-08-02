-- One included recovery sprint per paid membership billing month.
CREATE TABLE IF NOT EXISTS public.autopilot_membership_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_key DATE NOT NULL,
  invoice_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  prepared_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, period_key)
);

ALTER TABLE public.autopilot_membership_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.autopilot_membership_claims FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_autopilot_claims_user_period
  ON public.autopilot_membership_claims(user_id, period_key DESC);
