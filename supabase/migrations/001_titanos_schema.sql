-- TitanOS Supabase schema
-- Run in Supabase SQL editor or via `supabase db push`

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Profiles (extends auth.users) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_pro BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_pro)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    'user',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Entity tables ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  notes TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'lead',
  lifetime_value NUMERIC NOT NULL DEFAULT 0,
  score NUMERIC NOT NULL DEFAULT 0,
  photo_url TEXT
);

CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  customer_id TEXT,
  customer_name TEXT,
  assigned_to TEXT,
  assigned_name TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  priority TEXT NOT NULL DEFAULT 'medium',
  service_type TEXT,
  scheduled_date DATE,
  scheduled_time TEXT,
  estimated_duration NUMERIC,
  actual_duration NUMERIC,
  address TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  color TEXT NOT NULL DEFAULT '#00C7D9'
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invoice_number TEXT,
  customer_id TEXT,
  customer_name TEXT,
  job_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  balance_due NUMERIC NOT NULL DEFAULT 0,
  due_date DATE,
  payment_method TEXT,
  notes TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_interval TEXT
);

CREATE TABLE IF NOT EXISTS public.estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  estimate_number TEXT,
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  valid_until DATE,
  service_type TEXT,
  address TEXT
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT,
  date DATE,
  vendor TEXT,
  receipt_url TEXT,
  is_tax_deductible BOOLEAN NOT NULL DEFAULT false,
  tax_year INTEGER,
  business_use_percent NUMERIC NOT NULL DEFAULT 100,
  mileage_miles NUMERIC,
  job_id TEXT,
  employee_id TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'technician',
  status TEXT NOT NULL DEFAULT 'active',
  hourly_rate NUMERIC,
  color TEXT NOT NULL DEFAULT '#00C7D9',
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  photo_url TEXT,
  is_clocked_in BOOLEAN NOT NULL DEFAULT false,
  current_location TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS public.mileage_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  purpose TEXT NOT NULL,
  from_location TEXT,
  to_location TEXT,
  miles NUMERIC NOT NULL,
  customer_name TEXT,
  tax_year INTEGER,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.marketplace_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  rating NUMERIC NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  price NUMERIC NOT NULL DEFAULT 0,
  price_label TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '📦',
  gradient TEXT NOT NULL DEFAULT 'from-titan-indigo/20 to-purple-500/20',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  install_count INTEGER NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'available',
  route TEXT
);

CREATE TABLE IF NOT EXISTS public.module_installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  module_slug TEXT NOT NULL,
  module_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  installed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.module_waitlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  user_email TEXT,
  module_slug TEXT NOT NULL,
  module_name TEXT
);

CREATE TABLE IF NOT EXISTS public.developer_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  user_email TEXT,
  company TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referrer_user_id TEXT NOT NULL,
  referrer_email TEXT NOT NULL,
  referred_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  reward_redeemed BOOLEAN NOT NULL DEFAULT false,
  reward_redeemed_at TIMESTAMPTZ,
  reward_year INTEGER
);

CREATE TABLE IF NOT EXISTS public.beta_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  business_type TEXT,
  business_size TEXT,
  experience TEXT,
  why_join TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS public.beta_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  email TEXT,
  page TEXT,
  status TEXT NOT NULL DEFAULT 'new'
);

CREATE TABLE IF NOT EXISTS public.portal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  customer_id TEXT,
  otp_code TEXT,
  otp_expires_at TIMESTAMPTZ,
  verified BOOLEAN NOT NULL DEFAULT false,
  token TEXT,
  token_expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_portal_sessions_email ON public.portal_sessions(email);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_token ON public.portal_sessions(token);
CREATE INDEX IF NOT EXISTS idx_module_installs_user_slug ON public.module_installs(user_id, module_slug);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_user_id);

-- updated_at triggers
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'profiles', 'customers', 'jobs', 'invoices', 'estimates', 'expenses',
    'employees', 'mileage_trips', 'marketplace_modules', 'module_installs',
    'module_waitlists', 'developer_applications', 'referrals', 'beta_signups',
    'beta_feedbacks', 'portal_sessions'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%s_updated_at ON public.%s', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER set_%s_updated_at BEFORE UPDATE ON public.%s FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ─── Row Level Security ──────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mileage_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_installs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_waitlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_sessions ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING (id = auth.uid() OR public.is_admin());

-- owner-or-admin helper policies
CREATE POLICY customers_all ON public.customers FOR ALL
  USING (created_by_id = auth.uid() OR public.is_admin())
  WITH CHECK (created_by_id = auth.uid() OR public.is_admin());

CREATE POLICY jobs_all ON public.jobs FOR ALL
  USING (
    created_by_id = auth.uid()
    OR assigned_to = auth.uid()::text
    OR public.is_admin()
  )
  WITH CHECK (created_by_id = auth.uid() OR public.is_admin());

CREATE POLICY invoices_all ON public.invoices FOR ALL
  USING (created_by_id = auth.uid() OR public.is_admin())
  WITH CHECK (created_by_id = auth.uid() OR public.is_admin());

CREATE POLICY estimates_all ON public.estimates FOR ALL
  USING (created_by_id = auth.uid() OR public.is_admin())
  WITH CHECK (created_by_id = auth.uid() OR public.is_admin());

CREATE POLICY expenses_all ON public.expenses FOR ALL
  USING (created_by_id = auth.uid() OR public.is_admin())
  WITH CHECK (created_by_id = auth.uid() OR public.is_admin());

CREATE POLICY employees_select ON public.employees FOR SELECT
  USING (created_by_id = auth.uid() OR public.is_admin());
CREATE POLICY employees_insert ON public.employees FOR INSERT
  WITH CHECK (created_by_id = auth.uid() OR public.is_admin());
CREATE POLICY employees_update ON public.employees FOR UPDATE
  USING (created_by_id = auth.uid() OR public.is_admin());
CREATE POLICY employees_delete ON public.employees FOR DELETE
  USING (public.is_admin());

CREATE POLICY mileage_trips_all ON public.mileage_trips FOR ALL
  USING (created_by_id = auth.uid() OR public.is_admin())
  WITH CHECK (created_by_id = auth.uid() OR public.is_admin());

CREATE POLICY marketplace_modules_read ON public.marketplace_modules FOR SELECT USING (true);
CREATE POLICY marketplace_modules_admin ON public.marketplace_modules FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY module_installs_all ON public.module_installs FOR ALL
  USING (user_id = auth.uid()::text OR public.is_admin())
  WITH CHECK (user_id = auth.uid()::text OR public.is_admin());

CREATE POLICY module_waitlists_all ON public.module_waitlists FOR ALL
  USING (user_id = auth.uid()::text OR public.is_admin())
  WITH CHECK (user_id = auth.uid()::text OR public.is_admin());

CREATE POLICY developer_applications_select ON public.developer_applications FOR SELECT
  USING (user_id = auth.uid()::text OR public.is_admin());
CREATE POLICY developer_applications_insert ON public.developer_applications FOR INSERT
  WITH CHECK (user_id = auth.uid()::text OR public.is_admin());
CREATE POLICY developer_applications_admin ON public.developer_applications FOR UPDATE
  USING (public.is_admin());

CREATE POLICY referrals_all ON public.referrals FOR ALL
  USING (referrer_user_id = auth.uid()::text OR public.is_admin())
  WITH CHECK (referrer_user_id = auth.uid()::text OR public.is_admin());

CREATE POLICY beta_signups_insert ON public.beta_signups FOR INSERT WITH CHECK (true);
CREATE POLICY beta_signups_admin ON public.beta_signups FOR SELECT USING (public.is_admin());
CREATE POLICY beta_signups_admin_write ON public.beta_signups FOR UPDATE USING (public.is_admin());

CREATE POLICY beta_feedbacks_insert ON public.beta_feedbacks FOR INSERT WITH CHECK (true);
CREATE POLICY beta_feedbacks_admin ON public.beta_feedbacks FOR SELECT USING (public.is_admin());
CREATE POLICY beta_feedbacks_admin_write ON public.beta_feedbacks FOR UPDATE USING (public.is_admin());

-- portal_sessions: service role only (no user policies)

-- ─── Storage ───────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('titanos-uploads', 'titanos-uploads', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY titanos_uploads_read ON storage.objects FOR SELECT
  USING (bucket_id = 'titanos-uploads');
CREATE POLICY titanos_uploads_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'titanos-uploads' AND auth.uid() IS NOT NULL);
CREATE POLICY titanos_uploads_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'titanos-uploads' AND auth.uid() = owner);
