-- Account / plan typing for launch pricing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_tier TEXT;

COMMENT ON COLUMN public.profiles.account_type IS 'customer | worker | business';
COMMENT ON COLUMN public.profiles.plan_tier IS 'customer | worker_free | worker_premium | business';
