-- TitanOS platform expansion: listings marketplace, hire board, community,
-- activity, notifications, ratings, richer profiles & referrals.
-- Safe to re-run (IF NOT EXISTS / additive columns).

-- ─── Profiles expansion ──────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_state TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_zip TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_logo_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_pref TEXT NOT NULL DEFAULT 'system';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{
  "messages": true,
  "hires": true,
  "applications": true,
  "payments": true,
  "estimates": true,
  "referrals": true,
  "marketplace": true,
  "reviews": true,
  "activity": true
}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_prefs JSONB NOT NULL DEFAULT '{
  "show_in_community": false,
  "show_city": true,
  "share_completed_jobs": false
}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lifetime_premium BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS paying_subscriber BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS community_opt_in BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code
  ON public.profiles (referral_code) WHERE referral_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- Default expenses to tax-deductible for Schedule C tracking
ALTER TABLE public.expenses ALTER COLUMN is_tax_deductible SET DEFAULT true;

-- ─── Referrals expansion ─────────────────────────────────────────────────────
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referred_user_id TEXT;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS is_paying BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS fraud_flag BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS fraud_reason TEXT;

-- ─── Service listings marketplace (FREE during beta) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  seller_id TEXT NOT NULL,
  seller_name TEXT,
  seller_avatar TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General',
  price NUMERIC,
  price_type TEXT NOT NULL DEFAULT 'fixed' CHECK (price_type IN ('fixed', 'hourly', 'starting_at', 'quote')),
  city TEXT,
  state TEXT,
  location_label TEXT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  contact_phone TEXT,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft', 'removed')),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  view_count INTEGER NOT NULL DEFAULT 0,
  favorite_count INTEGER NOT NULL DEFAULT 0,
  rating_avg NUMERIC NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  moderated BOOLEAN NOT NULL DEFAULT false,
  moderation_notes TEXT
);

CREATE TABLE IF NOT EXISTS public.marketplace_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  listing_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.marketplace_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed', 'actioned'))
);

CREATE TABLE IF NOT EXISTS public.marketplace_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  listing_id TEXT,
  hire_job_id TEXT,
  thread_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.marketplace_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  listing_id TEXT,
  seller_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  reviewer_name TEXT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT,
  status TEXT NOT NULL DEFAULT 'published'
);

-- ─── Hire workers (two-sided job board) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hire_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General',
  city TEXT,
  state TEXT,
  budget_min NUMERIC,
  budget_max NUMERIC,
  deadline DATE,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'hired', 'completed', 'cancelled', 'closed')),
  hired_worker_id TEXT,
  application_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.hire_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  hire_job_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  worker_name TEXT,
  message TEXT,
  bid_amount NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn'))
);

-- ─── Community + live activity ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_id TEXT NOT NULL,
  author_username TEXT NOT NULL,
  city TEXT,
  state TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  description TEXT NOT NULL DEFAULT '',
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  job_id TEXT,
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'removed'))
);

CREATE TABLE IF NOT EXISTS public.community_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  post_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_username TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published'
);

CREATE TABLE IF NOT EXISTS public.activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_id TEXT,
  actor_name TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'job_completed',
  category TEXT,
  city TEXT,
  state TEXT,
  summary TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ─── Notifications ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ─── Job / peer ratings ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  job_id TEXT,
  hire_job_id TEXT,
  reviewer_id TEXT NOT NULL,
  reviewee_id TEXT NOT NULL,
  reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('customer', 'worker')),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT,
  badges JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.price_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  service_type TEXT,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  low_estimate NUMERIC,
  avg_estimate NUMERIC,
  premium_estimate NUMERIC,
  labor_cost NUMERIC,
  profit_estimate NUMERIC,
  suggested_price NUMERIC,
  notes TEXT
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_listings_status_cat ON public.marketplace_listings(status, category);
CREATE INDEX IF NOT EXISTS idx_listings_seller ON public.marketplace_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_location ON public.marketplace_listings(state, city);
CREATE INDEX IF NOT EXISTS idx_hire_jobs_status ON public.hire_jobs(status, category);
CREATE INDEX IF NOT EXISTS idx_activity_created ON public.activity_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON public.community_posts(created_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hire_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hire_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_estimates ENABLE ROW LEVEL SECURITY;

-- Authenticated users can manage their own rows; public read for browseables
DO $$ BEGIN
  CREATE POLICY listings_select ON public.marketplace_listings FOR SELECT TO authenticated
    USING (status = 'active' OR created_by_id = auth.uid() OR public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY listings_write ON public.marketplace_listings FOR ALL TO authenticated
    USING (created_by_id = auth.uid() OR public.is_admin())
    WITH CHECK (created_by_id = auth.uid() OR public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY favorites_own ON public.marketplace_favorites FOR ALL TO authenticated
    USING (created_by_id = auth.uid()) WITH CHECK (created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY reports_insert ON public.marketplace_reports FOR INSERT TO authenticated
    WITH CHECK (created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY reports_admin ON public.marketplace_reports FOR ALL TO authenticated
    USING (public.is_admin() OR created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY messages_own ON public.marketplace_messages FOR ALL TO authenticated
    USING (sender_id = auth.uid()::text OR recipient_id = auth.uid()::text OR created_by_id = auth.uid())
    WITH CHECK (created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY mkt_reviews_read ON public.marketplace_reviews FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY mkt_reviews_write ON public.marketplace_reviews FOR ALL TO authenticated
    USING (created_by_id = auth.uid()) WITH CHECK (created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY hire_jobs_read ON public.hire_jobs FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY hire_jobs_write ON public.hire_jobs FOR ALL TO authenticated
    USING (created_by_id = auth.uid() OR public.is_admin())
    WITH CHECK (created_by_id = auth.uid() OR public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY hire_apps_read ON public.hire_applications FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY hire_apps_write ON public.hire_applications FOR ALL TO authenticated
    USING (created_by_id = auth.uid() OR public.is_admin())
    WITH CHECK (created_by_id = auth.uid() OR public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY community_read ON public.community_posts FOR SELECT TO authenticated
    USING (status = 'published' OR created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY community_write ON public.community_posts FOR ALL TO authenticated
    USING (created_by_id = auth.uid() OR public.is_admin())
    WITH CHECK (created_by_id = auth.uid() OR public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY community_likes_own ON public.community_likes FOR ALL TO authenticated
    USING (created_by_id = auth.uid()) WITH CHECK (created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY community_comments_read ON public.community_comments FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY community_comments_write ON public.community_comments FOR ALL TO authenticated
    USING (created_by_id = auth.uid()) WITH CHECK (created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY activity_read ON public.activity_events FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY activity_write ON public.activity_events FOR INSERT TO authenticated
    WITH CHECK (created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY notifications_own ON public.notifications FOR ALL TO authenticated
    USING (user_id = auth.uid()::text OR created_by_id = auth.uid())
    WITH CHECK (user_id = auth.uid()::text OR created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY job_reviews_read ON public.job_reviews FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY job_reviews_write ON public.job_reviews FOR ALL TO authenticated
    USING (created_by_id = auth.uid()) WITH CHECK (created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY price_est_own ON public.price_estimates FOR ALL TO authenticated
    USING (created_by_id = auth.uid()) WITH CHECK (created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- updated_at triggers
DO $$ BEGIN
  CREATE TRIGGER trg_listings_updated BEFORE UPDATE ON public.marketplace_listings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
