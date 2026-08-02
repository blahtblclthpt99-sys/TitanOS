-- Production credential renewal history and feedback operations metadata.
ALTER TABLE public.credentials
  ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS archived_from_id UUID REFERENCES public.credentials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS renewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_credentials_archived_from
  ON public.credentials(archived_from_id)
  WHERE archived_from_id IS NOT NULL;

ALTER TABLE public.beta_feedbacks
  ADD COLUMN IF NOT EXISTS app_version TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS device TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS screenshot_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';

ALTER TABLE public.beta_feedbacks ALTER COLUMN status SET DEFAULT 'unread';
UPDATE public.beta_feedbacks SET status = 'unread' WHERE status = 'new';

CREATE INDEX IF NOT EXISTS idx_beta_feedbacks_status_created
  ON public.beta_feedbacks(status, created_at DESC);
