-- Verified outreach quality, durable suppression, and signed-provider event deduplication.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS email_quality_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (email_quality_status IN ('unverified', 'review', 'verified', 'quarantined')),
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_source_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS suppression_reason TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS suppressed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_outreach_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outreach_attempt_count INTEGER NOT NULL DEFAULT 0
    CHECK (outreach_attempt_count >= 0);

UPDATE public.leads
SET email_quality_status = 'verified',
    email_verified_at = COALESCE(email_verified_at, created_at),
    email_source_url = COALESCE(NULLIF(email_source_url, ''), website, '')
WHERE source = 'titan_lead_worker'
  AND COALESCE(website, '') <> ''
  AND email_quality_status = 'unverified';

UPDATE public.leads
SET email_quality_status = 'quarantined',
    suppression_reason = COALESCE(NULLIF(suppression_reason, ''), 'existing suppression'),
    suppressed_at = COALESCE(suppressed_at, updated_at, now())
WHERE outreach_status = 'suppressed';

CREATE INDEX IF NOT EXISTS idx_leads_owner_quality_outreach
  ON public.leads(created_by_id, email_quality_status, outreach_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_owner_emailed_at
  ON public.leads(created_by_id, emailed_at DESC)
  WHERE emailed_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.lead_outreach_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_outreach_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lead_outreach_webhook_events FROM anon, authenticated;
GRANT ALL ON public.lead_outreach_webhook_events TO service_role;

COMMENT ON TABLE public.lead_outreach_webhook_events IS
  'Server-only Resend webhook idempotency ledger; no client policies by design.';

CREATE OR REPLACE FUNCTION public.claim_lead_outreach(
  p_lead_id UUID,
  p_owner_id UUID,
  p_daily_limit INTEGER DEFAULT 5
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  reserved_count INTEGER;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner_id::text, 0));

  SELECT count(*) INTO reserved_count
  FROM public.leads
  WHERE created_by_id = p_owner_id
    AND outreach_status IN ('sending', 'sent')
    AND COALESCE(last_outreach_attempt_at, emailed_at, created_at) >= now() - interval '24 hours';

  IF reserved_count >= LEAST(100, GREATEST(1, p_daily_limit)) THEN
    RETURN FALSE;
  END IF;

  UPDATE public.leads
  SET outreach_status = 'sending',
      last_outreach_attempt_at = now(),
      updated_at = now()
  WHERE id = p_lead_id
    AND created_by_id = p_owner_id
    AND email_quality_status = 'verified'
    AND outreach_status IN ('ready', 'failed');

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_lead_outreach(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_lead_outreach(UUID, UUID, INTEGER) TO service_role;
