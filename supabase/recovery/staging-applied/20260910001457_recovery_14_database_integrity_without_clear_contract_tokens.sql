DROP POLICY IF EXISTS company_members_own ON public.company_members;
DROP POLICY IF EXISTS company_members_select ON public.company_members;
DROP POLICY IF EXISTS company_members_insert ON public.company_members;
DROP POLICY IF EXISTS company_members_update ON public.company_members;
DROP POLICY IF EXISTS company_members_delete ON public.company_members;
CREATE POLICY company_members_select ON public.company_members FOR SELECT TO authenticated USING (user_id=auth.uid()::text OR created_by_id=auth.uid() OR public.is_admin() OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id::text=company_members.company_id AND (c.owner_id=auth.uid()::text OR c.created_by_id=auth.uid())));
CREATE POLICY company_members_insert ON public.company_members FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR (created_by_id=auth.uid() AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id::text=company_id AND (c.owner_id=auth.uid()::text OR c.created_by_id=auth.uid()))));
CREATE POLICY company_members_update ON public.company_members FOR UPDATE TO authenticated USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id::text=company_members.company_id AND (c.owner_id=auth.uid()::text OR c.created_by_id=auth.uid()))) WITH CHECK (public.is_admin() OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id::text=company_id AND (c.owner_id=auth.uid()::text OR c.created_by_id=auth.uid())));
CREATE POLICY company_members_delete ON public.company_members FOR DELETE TO authenticated USING (public.is_admin() OR user_id=auth.uid()::text OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id::text=company_members.company_id AND (c.owner_id=auth.uid()::text OR c.created_by_id=auth.uid())));
CREATE INDEX IF NOT EXISTS idx_company_members_company ON public.company_members(company_id);

REVOKE ALL ON FUNCTION public.grant_lifetime_premium_if_eligible(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_lifetime_premium_if_eligible(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_lifetime_premium_if_eligible(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.protect_referral_paying_flags() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF COALESCE(auth.role(),'')='service_role' OR public.is_admin() THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
   NEW.is_paying:=false; NEW.fraud_flag:=COALESCE(NEW.fraud_flag,false); NEW.verified_at:=NULL;
   IF NEW.status IS NOT DISTINCT FROM 'completed' THEN NEW.status:='pending'; NEW.completed_at:=NULL; END IF;
 ELSIF TG_OP='UPDATE' THEN
   NEW.is_paying:=OLD.is_paying; NEW.verified_at:=OLD.verified_at; NEW.fraud_flag:=OLD.fraud_flag; NEW.fraud_reason:=OLD.fraud_reason;
   IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IS NOT DISTINCT FROM 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN RAISE EXCEPTION 'Referral completion is server-only'; END IF;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_protect_referral_paying ON public.referrals;
CREATE TRIGGER trg_protect_referral_paying BEFORE INSERT OR UPDATE ON public.referrals FOR EACH ROW EXECUTE FUNCTION public.protect_referral_paying_flags();
REVOKE ALL ON FUNCTION public.protect_referral_paying_flags() FROM PUBLIC;

CREATE TABLE IF NOT EXISTS public.titan_comms_channel_secrets (channel_id uuid PRIMARY KEY REFERENCES public.titan_comms_channels(id) ON DELETE CASCADE,password_hash text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.titan_comms_channel_secrets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS titan_comms_channels_select ON public.titan_comms_channels;
DROP POLICY IF EXISTS titan_comms_channels_insert ON public.titan_comms_channels;
DROP POLICY IF EXISTS titan_comms_channels_update ON public.titan_comms_channels;
DROP POLICY IF EXISTS titan_comms_channels_delete ON public.titan_comms_channels;
CREATE POLICY titan_comms_channels_select ON public.titan_comms_channels FOR SELECT TO authenticated USING (kind='public' OR created_by_id=auth.uid() OR EXISTS (SELECT 1 FROM public.titan_comms_members m WHERE m.channel_id=titan_comms_channels.id AND m.user_id=auth.uid()) OR public.is_admin());
CREATE POLICY titan_comms_channels_insert ON public.titan_comms_channels FOR INSERT TO authenticated WITH CHECK (created_by_id=auth.uid() OR public.is_admin());
CREATE POLICY titan_comms_channels_update ON public.titan_comms_channels FOR UPDATE TO authenticated USING (created_by_id=auth.uid() OR public.is_admin()) WITH CHECK (created_by_id=auth.uid() OR public.is_admin());
CREATE POLICY titan_comms_channels_delete ON public.titan_comms_channels FOR DELETE TO authenticated USING (created_by_id=auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS titan_comms_members_select ON public.titan_comms_members;
DROP POLICY IF EXISTS titan_comms_members_insert ON public.titan_comms_members;
DROP POLICY IF EXISTS titan_comms_members_update ON public.titan_comms_members;
DROP POLICY IF EXISTS titan_comms_members_delete ON public.titan_comms_members;
CREATE POLICY titan_comms_members_select ON public.titan_comms_members FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.is_admin() OR EXISTS (SELECT 1 FROM public.titan_comms_channels c WHERE c.id=titan_comms_members.channel_id AND c.created_by_id=auth.uid()));
CREATE POLICY titan_comms_members_insert ON public.titan_comms_members FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR EXISTS (SELECT 1 FROM public.titan_comms_channels c WHERE c.id=channel_id AND c.created_by_id=auth.uid()) OR (user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.titan_comms_channels c WHERE c.id=channel_id AND c.kind='public' AND COALESCE(c.is_password_protected,false)=false)));
CREATE OR REPLACE FUNCTION public.titan_comms_protect_membership_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF COALESCE(auth.role(),'')='service_role' OR public.is_admin() THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN NEW.channel_id:=OLD.channel_id; NEW.user_id:=OLD.user_id; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS titan_comms_members_identity_guard ON public.titan_comms_members;
CREATE TRIGGER titan_comms_members_identity_guard BEFORE UPDATE ON public.titan_comms_members FOR EACH ROW EXECUTE FUNCTION public.titan_comms_protect_membership_identity();
REVOKE ALL ON FUNCTION public.titan_comms_protect_membership_identity() FROM PUBLIC;
CREATE POLICY titan_comms_members_update ON public.titan_comms_members FOR UPDATE TO authenticated USING (user_id=auth.uid() OR public.is_admin() OR EXISTS (SELECT 1 FROM public.titan_comms_channels c WHERE c.id=titan_comms_members.channel_id AND c.created_by_id=auth.uid())) WITH CHECK (user_id=auth.uid() OR public.is_admin() OR EXISTS (SELECT 1 FROM public.titan_comms_channels c WHERE c.id=titan_comms_members.channel_id AND c.created_by_id=auth.uid()));
CREATE POLICY titan_comms_members_delete ON public.titan_comms_members FOR DELETE TO authenticated USING (user_id=auth.uid() OR public.is_admin() OR EXISTS (SELECT 1 FROM public.titan_comms_channels c WHERE c.id=titan_comms_members.channel_id AND c.created_by_id=auth.uid()));
DROP POLICY IF EXISTS titan_comms_messages_select ON public.titan_comms_messages;
DROP POLICY IF EXISTS titan_comms_messages_insert ON public.titan_comms_messages;
CREATE POLICY titan_comms_messages_select ON public.titan_comms_messages FOR SELECT TO authenticated USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.titan_comms_members m WHERE m.channel_id=titan_comms_messages.channel_id AND m.user_id=auth.uid()) OR EXISTS (SELECT 1 FROM public.titan_comms_channels c WHERE c.id=titan_comms_messages.channel_id AND c.kind='public'));
CREATE POLICY titan_comms_messages_insert ON public.titan_comms_messages FOR INSERT TO authenticated WITH CHECK (sender_id=auth.uid() AND (public.is_admin() OR EXISTS (SELECT 1 FROM public.titan_comms_members m WHERE m.channel_id=titan_comms_messages.channel_id AND m.user_id=auth.uid())));
CREATE INDEX IF NOT EXISTS titan_comms_members_user_idx ON public.titan_comms_members(user_id);

DROP POLICY IF EXISTS booking_pages_owner ON public.booking_pages;
DROP POLICY IF EXISTS booking_pages_public_read ON public.booking_pages;
CREATE POLICY booking_pages_owner ON public.booking_pages FOR ALL TO authenticated USING (created_by_id=auth.uid() OR public.is_admin()) WITH CHECK (created_by_id=auth.uid() OR public.is_admin());
CREATE POLICY booking_pages_public_read ON public.booking_pages FOR SELECT TO anon,authenticated USING (is_published=true);
DROP POLICY IF EXISTS booking_requests_owner ON public.booking_requests;
DROP POLICY IF EXISTS booking_requests_insert_anon ON public.booking_requests;
DROP POLICY IF EXISTS booking_requests_select ON public.booking_requests;
DROP POLICY IF EXISTS booking_requests_insert_auth ON public.booking_requests;
DROP POLICY IF EXISTS booking_requests_update ON public.booking_requests;
DROP POLICY IF EXISTS booking_requests_delete ON public.booking_requests;
CREATE POLICY booking_requests_select ON public.booking_requests FOR SELECT TO authenticated USING (created_by_id=auth.uid() OR owner_id=auth.uid()::text OR public.is_admin());
CREATE POLICY booking_requests_insert_auth ON public.booking_requests FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.booking_pages p WHERE p.id::text=booking_page_id AND p.is_published=true AND booking_requests.owner_id=p.owner_id));
CREATE POLICY booking_requests_insert_anon ON public.booking_requests FOR INSERT TO anon WITH CHECK (EXISTS (SELECT 1 FROM public.booking_pages p WHERE p.id::text=booking_page_id AND p.is_published=true AND booking_requests.owner_id=p.owner_id));
CREATE POLICY booking_requests_update ON public.booking_requests FOR UPDATE TO authenticated USING (owner_id=auth.uid()::text OR public.is_admin()) WITH CHECK (owner_id=auth.uid()::text OR public.is_admin());
CREATE POLICY booking_requests_delete ON public.booking_requests FOR DELETE TO authenticated USING (owner_id=auth.uid()::text OR public.is_admin());
DROP POLICY IF EXISTS availability_own ON public.availability_slots;
DROP POLICY IF EXISTS availability_public_read ON public.availability_slots;
CREATE POLICY availability_own ON public.availability_slots FOR ALL TO authenticated USING (created_by_id=auth.uid() OR public.is_admin()) WITH CHECK (created_by_id=auth.uid() OR public.is_admin());
CREATE POLICY availability_public_read ON public.availability_slots FOR SELECT TO anon,authenticated USING (EXISTS (SELECT 1 FROM public.booking_pages p WHERE p.owner_id=availability_slots.owner_id AND p.is_published=true));
DROP POLICY IF EXISTS job_photos_own ON public.job_photos;
CREATE POLICY job_photos_own ON public.job_photos FOR ALL TO authenticated USING (created_by_id=auth.uid() OR public.is_admin()) WITH CHECK (created_by_id=auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS job_checkins_own ON public.job_checkins;
CREATE POLICY job_checkins_own ON public.job_checkins FOR ALL TO authenticated USING (created_by_id=auth.uid() OR public.is_admin()) WITH CHECK (created_by_id=auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS contracts_own ON public.contracts;
DROP POLICY IF EXISTS contracts_public_read ON public.contracts;
CREATE POLICY contracts_own ON public.contracts FOR ALL TO authenticated USING (created_by_id=auth.uid() OR public.is_admin()) WITH CHECK (created_by_id=auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.protect_profile_privileges() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND COALESCE(auth.role(),'')<>'service_role' AND NOT public.is_admin() THEN
   NEW.role:=OLD.role; NEW.is_pro:=OLD.is_pro; NEW.lifetime_premium:=OLD.lifetime_premium;
   IF OLD.paying_subscriber IS NOT NULL THEN NEW.paying_subscriber:=OLD.paying_subscriber; END IF;
   NEW.plan_tier:=OLD.plan_tier; NEW.verified_worker:=OLD.verified_worker; NEW.verification_notes:=OLD.verification_notes;
   IF OLD.account_type IS NOT NULL AND btrim(OLD.account_type)<>'' THEN NEW.account_type:=OLD.account_type; END IF;
 END IF;
 RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.protect_escrow_settlement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF COALESCE(auth.role(),'')='service_role' OR public.is_admin() THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN NEW.status:=COALESCE(NULLIF(NEW.status,''),'held'); IF NEW.status IS DISTINCT FROM 'held' THEN RAISE EXCEPTION 'Escrow holds must start as held; settlement is server-only'; END IF;
 ELSIF TG_OP='UPDATE' THEN NEW.amount:=OLD.amount; IF NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'Escrow status changes are server-only'; END IF; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_protect_escrow_settlement ON public.escrow_holds;
CREATE TRIGGER trg_protect_escrow_settlement BEFORE INSERT OR UPDATE ON public.escrow_holds FOR EACH ROW EXECUTE FUNCTION public.protect_escrow_settlement();
REVOKE ALL ON FUNCTION public.protect_escrow_settlement() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.protect_invoice_paid_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF COALESCE(auth.role(),'')='service_role' OR public.is_admin() THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' AND NEW.status IS NOT DISTINCT FROM 'paid' THEN RAISE EXCEPTION 'Invoice paid status may only be set by payment webhook or admin'; END IF;
 IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN RAISE EXCEPTION 'Invoice paid status may only be set by payment webhook or admin'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_protect_invoice_paid ON public.invoices;
CREATE TRIGGER trg_protect_invoice_paid BEFORE INSERT OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.protect_invoice_paid_status();
REVOKE ALL ON FUNCTION public.protect_invoice_paid_status() FROM PUBLIC;

DROP POLICY IF EXISTS listings_write ON public.marketplace_listings;
CREATE POLICY listings_write ON public.marketplace_listings FOR ALL TO authenticated USING (created_by_id=auth.uid() OR public.is_admin()) WITH CHECK (public.is_admin() OR (created_by_id=auth.uid() AND seller_id=auth.uid()::text));
DROP POLICY IF EXISTS hire_jobs_write ON public.hire_jobs;
CREATE POLICY hire_jobs_write ON public.hire_jobs FOR ALL TO authenticated USING (created_by_id=auth.uid() OR public.is_admin()) WITH CHECK (public.is_admin() OR (created_by_id=auth.uid() AND customer_id=auth.uid()::text));
CREATE INDEX IF NOT EXISTS idx_customers_owner ON public.customers(created_by_id);
CREATE INDEX IF NOT EXISTS idx_jobs_owner_status ON public.jobs(created_by_id,status);
CREATE INDEX IF NOT EXISTS idx_invoices_owner_created ON public.invoices(created_by_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estimates_owner ON public.estimates(created_by_id);
CREATE INDEX IF NOT EXISTS idx_expenses_owner ON public.expenses(created_by_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_created ON public.marketplace_messages(recipient_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_created ON public.marketplace_messages(sender_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_listing ON public.marketplace_favorites(listing_id);
CREATE INDEX IF NOT EXISTS idx_customer_comms_customer ON public.customer_communications(customer_id);
COMMENT ON TABLE public.contracts IS 'Recovery staging: clear-token public RPCs intentionally omitted; hashed-token recovery migration required.';