-- TitanOS recovery migration: reconstruct the minimum lead-outreach foundation
-- that existed in production before 20260809035141_harden_lead_outreach.
--
-- Provenance:
-- * public.leads exists in the committed Phase 33 schema.
-- * the authoritative Supabase migration ledger shows that
--   20260809035141_harden_lead_outreach depends on website,
--   outreach_status, and emailed_at.
-- * no earlier recorded Supabase migration contains those column additions,
--   so they were production schema drift and cannot be restored verbatim.
--
-- Recovery policy: add only the columns proven necessary by the later
-- authoritative migration. Do not invent an enum/check constraint whose
-- historical contract cannot be demonstrated.

BEGIN;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS website TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS outreach_status TEXT NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.leads.website IS
  'Recovery of the pre-20260809035141 lead source website field; original DDL was not ledgered.';
COMMENT ON COLUMN public.leads.outreach_status IS
  'Recovery of the pre-20260809035141 outreach state field; later authoritative hardening uses ready, failed, sending, sent, and suppressed states.';
COMMENT ON COLUMN public.leads.emailed_at IS
  'Recovery of the pre-20260809035141 outreach delivery timestamp; original DDL was not ledgered.';

COMMIT;
