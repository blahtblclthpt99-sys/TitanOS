ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_invoices_paid_at ON public.invoices(paid_at DESC) WHERE paid_at IS NOT NULL;
COMMENT ON COLUMN public.invoices.paid_at IS 'Authoritative payment settlement timestamp. Set only by trusted server/payment lifecycle paths.';

CREATE OR REPLACE FUNCTION public.protect_payment_authority() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
BEGIN
 IF COALESCE(auth.role(),'')='service_role' OR public.is_admin() THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
   NEW.status:='pending'; NEW.external_id:=NULL; NEW.checkout_url:=NULL; NEW.base_amount:=NEW.amount; NEW.platform_fee:=0; NEW.platform_fee_rate:=0; NEW.amount_total:=NEW.amount; RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' THEN
   NEW.created_by_id:=OLD.created_by_id; NEW.user_id:=OLD.user_id; NEW.company_id:=OLD.company_id; NEW.invoice_id:=OLD.invoice_id; NEW.amount:=OLD.amount; NEW.currency:=OLD.currency; NEW.provider:=OLD.provider; NEW.status:=OLD.status; NEW.external_id:=OLD.external_id; NEW.checkout_url:=OLD.checkout_url; NEW.base_amount:=OLD.base_amount; NEW.platform_fee:=OLD.platform_fee; NEW.platform_fee_rate:=OLD.platform_fee_rate; NEW.amount_total:=OLD.amount_total; RETURN NEW;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_protect_payment_authority ON public.payments;
CREATE TRIGGER trg_protect_payment_authority BEFORE INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.protect_payment_authority();
REVOKE ALL ON FUNCTION public.protect_payment_authority() FROM PUBLIC;
DROP POLICY IF EXISTS payments_delete ON public.payments;
CREATE POLICY payments_delete ON public.payments FOR DELETE TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.is_company_owner(target_company_id text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT target_company_id IS NOT NULL AND (SELECT auth.uid()) IS NOT NULL AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id::text=target_company_id AND (c.owner_id=(SELECT auth.uid())::text OR c.created_by_id=(SELECT auth.uid())));
$$;
CREATE OR REPLACE FUNCTION public.is_company_member(target_company_id text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT target_company_id IS NOT NULL AND (SELECT auth.uid()) IS NOT NULL AND EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id=target_company_id AND m.user_id=(SELECT auth.uid())::text AND m.status='active');
$$;
REVOKE ALL ON FUNCTION public.is_company_owner(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.is_company_member(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_company_owner(text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.is_company_member(text) TO authenticated,service_role;
DROP POLICY IF EXISTS companies_member ON public.companies;
CREATE POLICY companies_member ON public.companies FOR ALL TO authenticated USING (owner_id=(SELECT auth.uid())::text OR created_by_id=(SELECT auth.uid()) OR (SELECT public.is_admin()) OR public.is_company_member(id::text)) WITH CHECK (owner_id=(SELECT auth.uid())::text OR created_by_id=(SELECT auth.uid()) OR (SELECT public.is_admin()));
DROP POLICY IF EXISTS company_members_select ON public.company_members;
CREATE POLICY company_members_select ON public.company_members FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid())::text OR created_by_id=(SELECT auth.uid()) OR (SELECT public.is_admin()) OR public.is_company_owner(company_id));
DROP POLICY IF EXISTS company_members_insert ON public.company_members;
CREATE POLICY company_members_insert ON public.company_members FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()) OR (created_by_id=(SELECT auth.uid()) AND public.is_company_owner(company_id)));
DROP POLICY IF EXISTS company_members_update ON public.company_members;
CREATE POLICY company_members_update ON public.company_members FOR UPDATE TO authenticated USING ((SELECT public.is_admin()) OR public.is_company_owner(company_id)) WITH CHECK ((SELECT public.is_admin()) OR public.is_company_owner(company_id));
DROP POLICY IF EXISTS company_members_delete ON public.company_members;
CREATE POLICY company_members_delete ON public.company_members FOR DELETE TO authenticated USING ((SELECT public.is_admin()) OR user_id=(SELECT auth.uid())::text OR public.is_company_owner(company_id));

CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS share_token_hash text;
UPDATE public.contracts SET share_token_hash=encode(digest(share_token,'sha256'),'hex') WHERE share_token IS NOT NULL AND length(share_token) BETWEEN 32 AND 256 AND (share_token_hash IS NULL OR share_token_hash='');
UPDATE public.contracts SET share_token=NULL WHERE share_token_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_share_token_hash ON public.contracts(share_token_hash) WHERE share_token_hash IS NOT NULL;
COMMENT ON COLUMN public.contracts.share_token_hash IS 'SHA-256 hash of the public contract bearer token. Raw signing tokens must never be stored.';
DROP FUNCTION IF EXISTS public.get_contract_by_share_token(text);
DROP FUNCTION IF EXISTS public.sign_contract_by_share_token(text,text,text);