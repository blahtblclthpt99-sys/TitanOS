-- TitanOS Phase expansion: equipment, inventory, follow-ups, licenses, leads
CREATE TABLE IF NOT EXISTS public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'tool',
  brand TEXT DEFAULT '',
  model TEXT DEFAULT '',
  serial_number TEXT DEFAULT '',
  purchase_date DATE,
  purchase_price NUMERIC DEFAULT 0,
  warranty_expires DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','service','retired','lost')),
  mileage NUMERIC DEFAULT 0,
  next_service_date DATE,
  notes TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  assigned_to TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'supplies',
  sku TEXT DEFAULT '',
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'ea',
  reorder_at NUMERIC NOT NULL DEFAULT 5,
  unit_cost NUMERIC DEFAULT 0,
  location TEXT DEFAULT '',
  notes TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.follow_up_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL DEFAULT 'job_completed',
  delay_days INTEGER NOT NULL DEFAULT 0,
  channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email','sms')),
  message_template TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.follow_up_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  customer_id TEXT,
  customer_name TEXT DEFAULT '',
  job_id TEXT,
  rule_id TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','skipped','failed')),
  channel TEXT NOT NULL DEFAULT 'in_app',
  message TEXT NOT NULL DEFAULT '',
  sent_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  credential_type TEXT NOT NULL DEFAULT 'license' CHECK (credential_type IN ('license','insurance','certification','permit','other')),
  issuer TEXT DEFAULT '',
  number TEXT DEFAULT '',
  issued_on DATE,
  expires_on DATE,
  reminder_days INTEGER NOT NULL DEFAULT 30,
  document_url TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  source TEXT DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','called','emailed','interested','scheduled','won','lost')),
  notes TEXT DEFAULT '',
  estimated_value NUMERIC DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_equipment_user ON public.equipment(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_user ON public.inventory_items(user_id);
CREATE INDEX IF NOT EXISTS idx_followups_user ON public.follow_up_queue(user_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_credentials_user ON public.credentials(user_id, expires_on);
CREATE INDEX IF NOT EXISTS idx_leads_user ON public.leads(user_id, status);

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY equipment_own ON public.equipment FOR ALL TO authenticated
    USING (created_by_id = auth.uid()) WITH CHECK (created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY inventory_own ON public.inventory_items FOR ALL TO authenticated
    USING (created_by_id = auth.uid()) WITH CHECK (created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY follow_rules_own ON public.follow_up_rules FOR ALL TO authenticated
    USING (created_by_id = auth.uid()) WITH CHECK (created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY follow_queue_own ON public.follow_up_queue FOR ALL TO authenticated
    USING (created_by_id = auth.uid()) WITH CHECK (created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY credentials_own ON public.credentials FOR ALL TO authenticated
    USING (created_by_id = auth.uid()) WITH CHECK (created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY leads_own ON public.leads FOR ALL TO authenticated
    USING (created_by_id = auth.uid()) WITH CHECK (created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
