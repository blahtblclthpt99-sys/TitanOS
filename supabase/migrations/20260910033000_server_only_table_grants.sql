-- TitanOS recovery hardening: keep sensitive session/secret tables server-only.
--
-- These tables intentionally have RLS enabled with no client policies. Revoke
-- the default API-role table grants as an additional least-privilege boundary;
-- application access must go through service-role server code or vetted
-- SECURITY DEFINER interfaces.

BEGIN;

REVOKE ALL PRIVILEGES ON TABLE public.portal_sessions FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.titan_comms_channel_secrets FROM anon, authenticated;

-- Preserve explicit server authority even if project-level default privileges
-- are tightened independently later.
GRANT ALL PRIVILEGES ON TABLE public.portal_sessions TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.titan_comms_channel_secrets TO service_role;

COMMIT;
