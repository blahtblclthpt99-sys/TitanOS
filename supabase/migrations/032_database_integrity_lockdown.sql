-- 032: Database integrity + least-privilege lockdown
-- P0: company self-join, referral premium forgery, TitanCom join/post, booking spoof,
--      verified_worker escalation, escrow client release.
-- P1: invoice INSERT paid, contract RPC status, availability scope, ownership indexes,
--      listing/hire seller/customer consistency, password_hash isolation.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) Company members — only owners/admins can add members to THEIR company
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) Referrals — is_paying / fraud / completion are server-only
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 3) TitanCom — membership + message least privilege; isolate password hashes
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 4) Booking requests — owner_id must match published booking page
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 5) Profiles — lock verified_worker / verification_notes
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 6) Escrow — clients cannot release / refund or change amount
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 7) Invoices — block INSERT status=paid as well as UPDATE
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 8) Contract share-token RPCs — only sent/signed; sign only from sent
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 9) Marketplace / hire — seller_id / customer_id must match creator
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 10) Ownership + hot-path indexes
-- ═══════════════════════════════════════════════════════════════════════════
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
