-- Signup email log (durable list of every account registration email)
CREATE TABLE IF NOT EXISTS public.signup_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  source TEXT NOT NULL DEFAULT 'register'
);

CREATE INDEX IF NOT EXISTS signup_emails_created_at_idx ON public.signup_emails (created_at DESC);

ALTER TABLE public.signup_emails ENABLE ROW LEVEL SECURITY;

-- Service role / admin only — no public read of signup emails
DROP POLICY IF EXISTS signup_emails_admin_select ON public.signup_emails;
CREATE POLICY signup_emails_admin_select ON public.signup_emails
  FOR SELECT USING (public.is_admin());

-- Allow service-role inserts (dashboard / Edge); public cannot read emails.
-- Service role bypasses RLS; this policy covers authenticated admin UI reads.
DROP POLICY IF EXISTS signup_emails_service_insert ON public.signup_emails;
-- No public INSERT policy — only service role (bypasses RLS) writes from /api/register.
