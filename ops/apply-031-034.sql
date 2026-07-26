-- TitanOS apply migrations 031 → 034 (run in Supabase SQL Editor in order).
-- Source files under supabase/migrations/


-- ========== supabase\migrations\031_titancom_channel_rules.sql ==========

-- TitanCom: channel expiry for free users + sole-admin semantics.
-- Apply on production after 030.

BEGIN;

ALTER TABLE public.titan_comms_channels
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMENT ON COLUMN public.titan_comms_channels.expires_at IS
  'When set, channel is daily/ephemeral (free tier). NULL = persistent (Premium).';

-- Creator remains sole admin: members may not promote themselves.
CREATE OR REPLACE FUNCTION public.titan_comms_prevent_admin_transfer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IN ('admin', 'owner') THEN
    IF EXISTS (
      SELECT 1 FROM public.titan_comms_channels c
      WHERE c.id = NEW.channel_id
        AND c.created_by_id IS DISTINCT FROM NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Only the channel creator can be admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS titan_comms_members_admin_guard ON public.titan_comms_members;
CREATE TRIGGER titan_comms_members_admin_guard
  BEFORE INSERT OR UPDATE OF role ON public.titan_comms_members
  FOR EACH ROW
  EXECUTE FUNCTION public.titan_comms_prevent_admin_transfer();

COMMIT;


-- ========== supabase\migrations\032_database_integrity_lockdown.sql ==========

-- 032: Database integrity + least-privilege lockdown
-- P0: company self-join, referral premium forgery, TitanCom join/post, booking spoof,
--      verified_worker escalation, escrow client release.
-- P1: invoice INSERT paid, contract RPC status, availability scope, ownership indexes,
--      listing/hire seller/customer consistency, password_hash isolation.

BEGIN;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 1) Company members â€” only owners/admins can add members to THEIR company
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
DROP POLICY IF EXISTS company_members_own ON public.company_members;

CREATE POLICY company_members_select ON public.company_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()::text
    OR created_by_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id::text = company_members.company_id
        AND (c.owner_id = auth.uid()::text OR c.created_by_id = auth.uid())
    )
  );

CREATE POLICY company_members_insert ON public.company_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      created_by_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.id::text = company_id
          AND (c.owner_id = auth.uid()::text OR c.created_by_id = auth.uid())
      )
    )
  );

CREATE POLICY company_members_update ON public.company_members
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id::text = company_members.company_id
        AND (c.owner_id = auth.uid()::text OR c.created_by_id = auth.uid())
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id::text = company_id
        AND (c.owner_id = auth.uid()::text OR c.created_by_id = auth.uid())
    )
  );

CREATE POLICY company_members_delete ON public.company_members
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id::text = company_members.company_id
        AND (c.owner_id = auth.uid()::text OR c.created_by_id = auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS idx_company_members_company
  ON public.company_members (company_id);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 2) Referrals â€” is_paying / fraud / completion are server-only
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
REVOKE ALL ON FUNCTION public.grant_lifetime_premium_if_eligible(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_lifetime_premium_if_eligible(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_lifetime_premium_if_eligible(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.protect_referral_paying_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_paying := false;
    NEW.fraud_flag := COALESCE(NEW.fraud_flag, false);
    NEW.verified_at := NULL;
    IF NEW.status IS NOT DISTINCT FROM 'completed' THEN
      NEW.status := 'pending';
      NEW.completed_at := NULL;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.is_paying := OLD.is_paying;
    NEW.verified_at := OLD.verified_at;
    NEW.fraud_flag := OLD.fraud_flag;
    NEW.fraud_reason := OLD.fraud_reason;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status IS NOT DISTINCT FROM 'completed'
       AND OLD.status IS DISTINCT FROM 'completed' THEN
      RAISE EXCEPTION 'Referral completion is server-only';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_referral_paying ON public.referrals;
CREATE TRIGGER trg_protect_referral_paying
  BEFORE INSERT OR UPDATE ON public.referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_referral_paying_flags();

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 3) TitanCom â€” membership + message least privilege; isolate password hashes
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
CREATE TABLE IF NOT EXISTS public.titan_comms_channel_secrets (
  channel_id uuid PRIMARY KEY REFERENCES public.titan_comms_channels (id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.titan_comms_channel_secrets ENABLE ROW LEVEL SECURITY;
-- No client policies: service_role / SECURITY DEFINER RPCs only.

INSERT INTO public.titan_comms_channel_secrets (channel_id, password_hash)
SELECT id, password_hash
FROM public.titan_comms_channels
WHERE password_hash IS NOT NULL AND btrim(password_hash) <> ''
ON CONFLICT (channel_id) DO UPDATE
  SET password_hash = EXCLUDED.password_hash, updated_at = now();

ALTER TABLE public.titan_comms_channels DROP COLUMN IF EXISTS password_hash;

DROP POLICY IF EXISTS titan_comms_members_insert ON public.titan_comms_members;
CREATE POLICY titan_comms_members_insert ON public.titan_comms_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.titan_comms_channels c
        WHERE c.id = channel_id
          AND (
            c.created_by_id = auth.uid()
            OR (
              c.kind = 'public'
              AND COALESCE(c.is_password_protected, false) = false
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS titan_comms_messages_insert ON public.titan_comms_messages;
CREATE POLICY titan_comms_messages_insert ON public.titan_comms_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.titan_comms_members m
        WHERE m.channel_id = titan_comms_messages.channel_id
          AND m.user_id = auth.uid()
      )
    )
  );

CREATE INDEX IF NOT EXISTS titan_comms_members_user_idx
  ON public.titan_comms_members (user_id);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 4) Booking requests â€” owner_id must match published booking page
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
DROP POLICY IF EXISTS booking_requests_owner ON public.booking_requests;
DROP POLICY IF EXISTS booking_requests_insert_anon ON public.booking_requests;

CREATE POLICY booking_requests_select ON public.booking_requests
  FOR SELECT TO authenticated
  USING (
    created_by_id = auth.uid()
    OR owner_id = auth.uid()::text
    OR public.is_admin()
  );

CREATE POLICY booking_requests_insert_auth ON public.booking_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.booking_pages p
      WHERE p.id::text = booking_page_id
        AND p.is_published = true
        AND booking_requests.owner_id = p.owner_id
    )
  );

CREATE POLICY booking_requests_insert_anon ON public.booking_requests
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.booking_pages p
      WHERE p.id::text = booking_page_id
        AND p.is_published = true
        AND booking_requests.owner_id = p.owner_id
    )
  );

CREATE POLICY booking_requests_update ON public.booking_requests
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()::text OR public.is_admin())
  WITH CHECK (owner_id = auth.uid()::text OR public.is_admin());

CREATE POLICY booking_requests_delete ON public.booking_requests
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid()::text OR public.is_admin());

-- Availability: only slots for owners with a published booking page
DROP POLICY IF EXISTS availability_public_read ON public.availability_slots;
CREATE POLICY availability_public_read ON public.availability_slots
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.booking_pages p
      WHERE p.owner_id = availability_slots.owner_id
        AND p.is_published = true
    )
  );

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 5) Profiles â€” lock verified_worker / verification_notes
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin() THEN
    NEW.role := OLD.role;
    NEW.is_pro := OLD.is_pro;
    NEW.lifetime_premium := OLD.lifetime_premium;
    IF OLD.paying_subscriber IS NOT NULL THEN
      NEW.paying_subscriber := OLD.paying_subscriber;
    END IF;
    NEW.plan_tier := OLD.plan_tier;
    NEW.verified_worker := OLD.verified_worker;
    NEW.verification_notes := OLD.verification_notes;
    IF OLD.account_type IS NOT NULL AND btrim(OLD.account_type) <> '' THEN
      NEW.account_type := OLD.account_type;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 6) Escrow â€” clients cannot release / refund or change amount
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
CREATE OR REPLACE FUNCTION public.protect_escrow_settlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := COALESCE(NULLIF(NEW.status, ''), 'held');
    IF NEW.status IS DISTINCT FROM 'held' THEN
      RAISE EXCEPTION 'Escrow holds must start as held; settlement is server-only';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.amount := OLD.amount;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Escrow status changes are server-only';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_escrow_settlement ON public.escrow_holds;
CREATE TRIGGER trg_protect_escrow_settlement
  BEFORE INSERT OR UPDATE ON public.escrow_holds
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_escrow_settlement();

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 7) Invoices â€” block INSERT status=paid as well as UPDATE
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
CREATE OR REPLACE FUNCTION public.protect_invoice_paid_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.status IS NOT DISTINCT FROM 'paid' THEN
    RAISE EXCEPTION 'Invoice paid status may only be set by payment webhook or admin';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.status IS NOT DISTINCT FROM 'paid'
     AND OLD.status IS DISTINCT FROM 'paid' THEN
    RAISE EXCEPTION 'Invoice paid status may only be set by payment webhook or admin';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_invoice_paid ON public.invoices;
CREATE TRIGGER trg_protect_invoice_paid
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_invoice_paid_status();

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 8) Contract share-token RPCs â€” only sent/signed; sign only from sent
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
CREATE OR REPLACE FUNCTION public.get_contract_by_share_token(p_token text)
RETURNS SETOF public.contracts
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.contracts
  WHERE share_token = p_token
    AND share_token IS NOT NULL
    AND length(p_token) >= 16
    AND status IN ('sent', 'signed')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.sign_contract_by_share_token(
  p_token text,
  p_signature text,
  p_signature_image text DEFAULT NULL
)
RETURNS SETOF public.contracts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.contracts
  SET
    customer_signature = COALESCE(NULLIF(p_signature, ''), customer_signature),
    customer_signature_image = COALESCE(p_signature_image, customer_signature_image),
    status = CASE
      WHEN owner_signature IS NOT NULL AND NULLIF(p_signature, '') IS NOT NULL THEN 'signed'
      ELSE status
    END,
    signed_at = CASE
      WHEN owner_signature IS NOT NULL AND NULLIF(p_signature, '') IS NOT NULL THEN now()
      ELSE signed_at
    END,
    updated_at = now()
  WHERE share_token = p_token
    AND share_token IS NOT NULL
    AND length(p_token) >= 16
    AND status = 'sent';

  RETURN QUERY
  SELECT *
  FROM public.contracts
  WHERE share_token = p_token
    AND status IN ('sent', 'signed')
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_contract_by_share_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sign_contract_by_share_token(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contract_by_share_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sign_contract_by_share_token(text, text, text) TO anon, authenticated;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 9) Marketplace / hire â€” seller_id / customer_id must match creator
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
DROP POLICY IF EXISTS listings_write ON public.marketplace_listings;
CREATE POLICY listings_write ON public.marketplace_listings
  FOR ALL TO authenticated
  USING (created_by_id = auth.uid() OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (created_by_id = auth.uid() AND seller_id = auth.uid()::text)
  );

DROP POLICY IF EXISTS hire_jobs_write ON public.hire_jobs;
CREATE POLICY hire_jobs_write ON public.hire_jobs
  FOR ALL TO authenticated
  USING (created_by_id = auth.uid() OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (created_by_id = auth.uid() AND customer_id = auth.uid()::text)
  );

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 10) Ownership + hot-path indexes
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
CREATE INDEX IF NOT EXISTS idx_customers_owner
  ON public.customers (created_by_id);
CREATE INDEX IF NOT EXISTS idx_jobs_owner_status
  ON public.jobs (created_by_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_owner_created
  ON public.invoices (created_by_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estimates_owner
  ON public.estimates (created_by_id);
CREATE INDEX IF NOT EXISTS idx_expenses_owner
  ON public.expenses (created_by_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_created
  ON public.marketplace_messages (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_created
  ON public.marketplace_messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_listing
  ON public.marketplace_favorites (listing_id);
CREATE INDEX IF NOT EXISTS idx_customer_comms_customer
  ON public.customer_communications (customer_id);

COMMIT;


-- ========== supabase\migrations\033_audit_events.sql ==========

-- Universal audit trail for admin / money / privilege mutations.
-- Service role writes; admins may read. No client inserts.
--
-- NOTE: profiles has role='admin', not an is_admin column.
-- Use public.is_admin() (same as all other RLS policies).

CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_time_idx
  ON public.audit_events (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_actor_idx
  ON public.audit_events (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_entity_idx
  ON public.audit_events (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS audit_events_action_idx
  ON public.audit_events (action, created_at DESC);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_events_admin_select ON public.audit_events;
CREATE POLICY audit_events_admin_select ON public.audit_events
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policies for authenticated â€” service role only.
COMMENT ON TABLE public.audit_events IS 'Append-only ops audit; metadata must not contain secrets.';


-- ========== supabase\migrations\034_scalability_hot_paths.sql ==========

-- Scalability hot-path indexes + cloud driver trip journal foundation.
-- Assumes millions of jobs/trips/notifications; indexes match RLS/filter columns.

-- â”€â”€ Customer-scoped history (CustomerDetail, CRM) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX IF NOT EXISTS jobs_customer_scheduled_idx
  ON public.jobs (customer_id, scheduled_date DESC NULLS LAST)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS invoices_customer_created_idx
  ON public.invoices (customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS estimates_customer_created_idx
  ON public.estimates (customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

-- â”€â”€ Owner timelines â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX IF NOT EXISTS jobs_owner_created_idx
  ON public.jobs (created_by_id, created_at DESC);

CREATE INDEX IF NOT EXISTS jobs_owner_status_scheduled_idx
  ON public.jobs (created_by_id, status, scheduled_date DESC NULLS LAST);

-- â”€â”€ Unread notification badge (head/count hot path) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- â”€â”€ Cloud driver trip journal (device cache remains; sync when online) â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.driver_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'completed',
  miles NUMERIC NOT NULL DEFAULT 0,
  earnings NUMERIC,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT driver_trips_user_client_uidx UNIQUE (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS driver_trips_user_started_idx
  ON public.driver_trips (user_id, started_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS driver_trips_user_created_idx
  ON public.driver_trips (user_id, created_at DESC);

ALTER TABLE public.driver_trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS driver_trips_own_select ON public.driver_trips;
CREATE POLICY driver_trips_own_select ON public.driver_trips
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS driver_trips_own_insert ON public.driver_trips;
CREATE POLICY driver_trips_own_insert ON public.driver_trips
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS driver_trips_own_update ON public.driver_trips;
CREATE POLICY driver_trips_own_update ON public.driver_trips
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS driver_trips_own_delete ON public.driver_trips;
CREATE POLICY driver_trips_own_delete ON public.driver_trips
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.driver_trips IS
  'Cloud trip journal for multi-device / scale. Local MAX_JOURNAL is a cache ring, not the system of record once synced.';

