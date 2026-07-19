-- TitanOS Final ~33%: portal actions, insurance sync, deeper ops

CREATE TABLE IF NOT EXISTS public.insurance_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  doc_type TEXT NOT NULL DEFAULT 'liability',
  carrier TEXT DEFAULT '',
  policy_number TEXT DEFAULT '',
  expires_on DATE,
  size_label TEXT DEFAULT '',
  notes TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.portal_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  customer_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT DEFAULT '',
  entity_id TEXT DEFAULT '',
  meta JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_insurance_docs_user ON public.insurance_docs(user_id);
CREATE INDEX IF NOT EXISTS idx_portal_actions_customer ON public.portal_actions(customer_id, created_at DESC);

ALTER TABLE public.insurance_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_actions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY insurance_docs_own ON public.insurance_docs FOR ALL TO authenticated
    USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY portal_actions_service ON public.portal_actions FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Optional geofence fields on jobs (safe if columns already exist)
DO $$ BEGIN
  ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS site_lat DOUBLE PRECISION;
  ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS site_lng DOUBLE PRECISION;
  ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS geofence_m INTEGER DEFAULT 150;
EXCEPTION WHEN others THEN NULL; END $$;

-- Contract signature image + audit
DO $$ BEGIN
  ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS customer_signature_image TEXT;
  ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS owner_signature_image TEXT;
  ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS signed_ip TEXT;
  ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS signed_user_agent TEXT;
EXCEPTION WHEN others THEN NULL; END $$;
