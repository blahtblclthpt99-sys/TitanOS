-- Optional columns for AI job summaries (safe if already present)
DO $$ BEGIN
  ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
  ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS completion_summary TEXT;
  ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS follow_up_draft TEXT;
  ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS customer_notes_draft TEXT;
  ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS maintenance_reminder TEXT;
EXCEPTION WHEN others THEN NULL; END $$;
