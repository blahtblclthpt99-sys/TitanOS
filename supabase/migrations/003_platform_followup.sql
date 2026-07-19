-- TitanOS follow-up tables + lifetime premium grant helper
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.customer_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'note',
  body TEXT NOT NULL DEFAULT '',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'file'
);

CREATE TABLE IF NOT EXISTS public.hire_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  hire_job_id TEXT NOT NULL
);

ALTER TABLE public.customer_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hire_saves ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY customer_comms_own ON public.customer_communications FOR ALL TO authenticated
    USING (created_by_id = auth.uid()) WITH CHECK (created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY customer_files_own ON public.customer_files FOR ALL TO authenticated
    USING (created_by_id = auth.uid()) WITH CHECK (created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY hire_saves_own ON public.hire_saves FOR ALL TO authenticated
    USING (created_by_id = auth.uid()) WITH CHECK (created_by_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service-role callable from API: grant lifetime premium when eligible
CREATE OR REPLACE FUNCTION public.grant_lifetime_premium_if_eligible(p_referrer_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  paying_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO paying_count
  FROM public.referrals
  WHERE referrer_user_id = p_referrer_id::text
    AND is_paying = true
    AND COALESCE(fraud_flag, false) = false;

  IF paying_count >= 3 THEN
    UPDATE public.profiles
    SET lifetime_premium = true,
        is_pro = true,
        updated_at = now()
    WHERE id = p_referrer_id;
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_lifetime_premium_if_eligible(UUID) TO service_role;
