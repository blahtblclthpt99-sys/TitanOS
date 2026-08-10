-- Titan Auto Lead: durable worker discovery and email delivery state.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS company TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS website TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS discovery_reason TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS outreach_status TEXT NOT NULL DEFAULT 'ready'
    CHECK (outreach_status IN ('ready', 'sending', 'sent', 'failed', 'suppressed')),
  ADD COLUMN IF NOT EXISTS outreach_subject TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS outreach_message TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS outreach_provider_id TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS outreach_error TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_owner_outreach
  ON public.leads(created_by_id, outreach_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_owner_email_lower
  ON public.leads(created_by_id, lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;

-- Existing leads_own policy restricts every operation to created_by_id = auth.uid().
-- Recreate explicitly so repaired/partial environments retain full ownership checks.
DROP POLICY IF EXISTS leads_own ON public.leads;
CREATE POLICY leads_own ON public.leads
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = created_by_id)
  WITH CHECK ((SELECT auth.uid()) = created_by_id);
