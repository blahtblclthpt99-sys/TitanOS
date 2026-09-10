CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA private TO authenticated,service_role;

CREATE OR REPLACE FUNCTION private.is_admin_internal() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id=(SELECT auth.uid()) AND role='admin');
$$;
REVOKE ALL ON FUNCTION private.is_admin_internal() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.is_admin_internal() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.is_admin_internal(); $$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION private.is_company_owner_internal(target_company_id text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT target_company_id IS NOT NULL AND (SELECT auth.uid()) IS NOT NULL AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id::text=target_company_id AND (c.owner_id=(SELECT auth.uid())::text OR c.created_by_id=(SELECT auth.uid())));
$$;
CREATE OR REPLACE FUNCTION private.is_company_member_internal(target_company_id text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT target_company_id IS NOT NULL AND (SELECT auth.uid()) IS NOT NULL AND EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id=target_company_id AND m.user_id=(SELECT auth.uid())::text AND m.status='active');
$$;
REVOKE ALL ON FUNCTION private.is_company_owner_internal(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.is_company_member_internal(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.is_company_owner_internal(text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.is_company_member_internal(text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.is_company_owner(target_company_id text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.is_company_owner_internal(target_company_id); $$;
CREATE OR REPLACE FUNCTION public.is_company_member(target_company_id text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.is_company_member_internal(target_company_id); $$;
REVOKE ALL ON FUNCTION public.is_company_owner(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.is_company_member(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_company_owner(text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.is_company_member(text) TO authenticated,service_role;

ALTER FUNCTION public.set_updated_at() SET search_path=public;
ALTER FUNCTION public.titan_comms_prevent_admin_transfer() SET search_path=public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.protect_escrow_settlement() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.protect_invoice_paid_status() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.protect_message_body() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.protect_payment_authority() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_privileges() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.protect_referral_paying_flags() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.titan_comms_protect_membership_identity() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.titan_comms_prevent_admin_transfer() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_escrow_settlement() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_invoice_paid_status() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_message_body() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_payment_authority() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_profile_privileges() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_referral_paying_flags() TO service_role;
GRANT EXECUTE ON FUNCTION public.titan_comms_protect_membership_identity() TO service_role;
GRANT EXECUTE ON FUNCTION public.titan_comms_prevent_admin_transfer() TO service_role;