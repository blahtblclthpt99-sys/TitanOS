CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL, logo_url TEXT, address TEXT, city TEXT, state TEXT, zip TEXT, phone TEXT, email TEXT, owner_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')), status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','removed'))
);
CREATE TABLE IF NOT EXISTS public.payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL, company_id TEXT, provider TEXT NOT NULL CHECK (provider IN ('stripe','square','paypal')), account_label TEXT NOT NULL DEFAULT '', external_account_id TEXT, is_connected BOOLEAN NOT NULL DEFAULT false, metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL, company_id TEXT, invoice_id TEXT, customer_name TEXT, amount NUMERIC NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'usd', provider TEXT NOT NULL DEFAULT 'stripe', status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed','refunded','canceled')), external_id TEXT, checkout_url TEXT, note TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS public.receipt_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL, image_url TEXT, raw_text TEXT DEFAULT '', vendor TEXT, amount NUMERIC, date DATE, category TEXT, expense_id TEXT, confidence NUMERIC DEFAULT 0, status TEXT NOT NULL DEFAULT 'parsed'
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_company_id TEXT;
CREATE INDEX IF NOT EXISTS idx_company_members_user ON public.company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipt_scans_user ON public.receipt_scans(user_id);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_scans ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.companies IS 'Recovery staging: legacy company/member policy intentionally omitted pending post-recursion hardened RLS.';
COMMENT ON TABLE public.payments IS 'Recovery staging: fail-closed pending payment authority and settlement hardening.';