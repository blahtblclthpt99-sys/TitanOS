-- Booking pages, job GPS/photos, availability, contracts, verification
CREATE TABLE IF NOT EXISTS public.booking_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_id TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Book with me',
  bio TEXT DEFAULT '',
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  service_area TEXT DEFAULT '',
  city TEXT,
  state TEXT,
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  accepts_same_day BOOLEAN NOT NULL DEFAULT true,
  verified_badge BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  booking_page_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  service TEXT,
  preferred_date DATE,
  preferred_time TEXT,
  notes TEXT DEFAULT '',
  urgency TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','accepted','declined','completed','cancelled')),
  is_same_day BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.availability_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_id TEXT NOT NULL,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.job_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  job_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'after' CHECK (kind IN ('before','after','other')),
  url TEXT NOT NULL,
  caption TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.job_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  job_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('check_in','check_out')),
  lat NUMERIC,
  lng NUMERIC,
  accuracy_m NUMERIC,
  note TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_id TEXT NOT NULL,
  customer_id TEXT,
  customer_name TEXT,
  job_id TEXT,
  title TEXT NOT NULL DEFAULT 'Service Agreement',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','signed','void')),
  customer_signature TEXT,
  owner_signature TEXT,
  signed_at TIMESTAMPTZ,
  share_token TEXT UNIQUE
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified_worker BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_notes TEXT;
ALTER TABLE public.hire_jobs ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.hire_jobs ADD COLUMN IF NOT EXISTS is_same_day BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_booking_pages_slug ON public.booking_pages(slug);
CREATE INDEX IF NOT EXISTS idx_booking_requests_owner ON public.booking_requests(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_job_photos_job ON public.job_photos(job_id);
CREATE INDEX IF NOT EXISTS idx_job_checkins_job ON public.job_checkins(job_id);
CREATE INDEX IF NOT EXISTS idx_contracts_token ON public.contracts(share_token);

ALTER TABLE public.booking_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY booking_pages_owner ON public.booking_pages FOR ALL TO authenticated
    USING (created_by_id = auth.uid() OR public.is_admin())
    WITH CHECK (created_by_id = auth.uid() OR public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY booking_pages_public_read ON public.booking_pages FOR SELECT TO anon, authenticated
    USING (is_published = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY booking_requests_owner ON public.booking_requests FOR ALL TO authenticated
    USING (created_by_id = auth.uid() OR owner_id = auth.uid()::text OR public.is_admin())
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY booking_requests_insert_anon ON public.booking_requests FOR INSERT TO anon
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY availability_own ON public.availability_slots FOR ALL TO authenticated
    USING (created_by_id = auth.uid()) WITH CHECK (created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY availability_public_read ON public.availability_slots FOR SELECT TO anon, authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY job_photos_own ON public.job_photos FOR ALL TO authenticated
    USING (created_by_id = auth.uid() OR public.is_admin())
    WITH CHECK (created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY job_checkins_own ON public.job_checkins FOR ALL TO authenticated
    USING (created_by_id = auth.uid()) WITH CHECK (created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY contracts_own ON public.contracts FOR ALL TO authenticated
    USING (created_by_id = auth.uid() OR public.is_admin())
    WITH CHECK (created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY contracts_public_read ON public.contracts FOR SELECT TO anon, authenticated
    USING (share_token IS NOT NULL AND status IN ('sent','signed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
