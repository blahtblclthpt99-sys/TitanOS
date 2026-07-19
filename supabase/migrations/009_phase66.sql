-- TitanOS Phase ~66%: growth, trust, and automation surfaces
CREATE TABLE IF NOT EXISTS public.loyalty_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  customer_id TEXT,
  customer_name TEXT NOT NULL DEFAULT '',
  points INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','platinum')),
  notes TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.loyalty_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  points_delta INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS public.emergency_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  budget NUMERIC DEFAULT 0,
  urgency TEXT NOT NULL DEFAULT 'same_day' CHECK (urgency IN ('same_day','next_day','asap')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','claimed','closed')),
  contact_name TEXT DEFAULT '',
  contact_phone TEXT DEFAULT '',
  notes TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.escrow_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  job_title TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held','released','refunded','disputed')),
  invoice_id TEXT,
  job_id TEXT,
  customer_confirmed BOOLEAN NOT NULL DEFAULT false,
  provider_confirmed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.marketing_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'facebook' CHECK (channel IN ('facebook','instagram','google','email','flyer')),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  cta TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','posted'))
);

CREATE TABLE IF NOT EXISTS public.phone_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Main greeting',
  greeting TEXT NOT NULL DEFAULT '',
  faq_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  transfer_number TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_loyalty_members_user ON public.loyalty_members(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_events_user ON public.loyalty_events(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_jobs_user ON public.emergency_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_escrow_holds_user ON public.escrow_holds(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_assets_user ON public.marketing_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_scripts_user ON public.phone_scripts(user_id);

ALTER TABLE public.loyalty_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_scripts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'loyalty_members','loyalty_events','emergency_jobs','escrow_holds','marketing_assets','phone_scripts'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (auth.uid()::text = user_id OR created_by_id = auth.uid()) WITH CHECK (auth.uid()::text = user_id OR created_by_id = auth.uid())',
      t || '_owner_all', t
    );
  END LOOP;
END $$;
