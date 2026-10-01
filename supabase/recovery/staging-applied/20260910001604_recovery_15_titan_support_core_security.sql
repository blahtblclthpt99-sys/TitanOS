CREATE OR REPLACE FUNCTION public.is_support_staff()
RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT COALESCE(((SELECT auth.jwt())->'app_metadata'->>'role') = ANY (ARRAY['support_agent','senior_support','support_engineering','billing_support','support_admin','admin']::text[]),false);
$$;
CREATE OR REPLACE FUNCTION public.is_support_admin()
RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT COALESCE(((SELECT auth.jwt())->'app_metadata'->>'role') = ANY (ARRAY['support_admin','admin']::text[]),false);
$$;
REVOKE ALL ON FUNCTION public.is_support_staff() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.is_support_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_support_staff() TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.is_support_admin() TO authenticated,service_role;

CREATE TABLE IF NOT EXISTS public.support_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_number text NOT NULL UNIQUE DEFAULT ('T-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),created_by_id uuid NOT NULL,company_id text,title text NOT NULL CHECK(char_length(title) BETWEEN 3 AND 180),description text NOT NULL CHECK(char_length(description) BETWEEN 3 AND 10000),category text NOT NULL DEFAULT 'technical' CHECK(category IN ('account','billing','jobs','customers','scheduling','estimates','invoices','money','driver_hub','gps','mileage','titan_ai','invisible_interface','android','pwa','notifications','communications','files','import_export','technical','security','other')),status text NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW','AI_WORKING','NEEDS_USER','HUMAN_AGENT','ENGINEERING','RESOLVED','CLOSED')),priority text NOT NULL DEFAULT 'P3' CHECK(priority IN ('P0','P1','P2','P3','P4')),source text NOT NULL DEFAULT 'support_center' CHECK(source IN ('support_center','contextual_error','feedback','agent','system')),platform text,app_version text,last_message_at timestamptz NOT NULL DEFAULT now(),first_response_at timestamptz,escalated_at timestamptz,resolved_at timestamptz,closed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.support_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES public.support_cases(id) ON DELETE CASCADE,sender_user_id uuid,sender_kind text NOT NULL CHECK(sender_kind IN ('customer','support_ai','agent','engineering','system')),body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 10000),metadata jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.support_case_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES public.support_cases(id) ON DELETE CASCADE,actor_user_id uuid,event_type text NOT NULL CHECK(char_length(event_type) BETWEEN 2 AND 80),from_status text,to_status text,details jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.support_diagnostics (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES public.support_cases(id) ON DELETE CASCADE,created_by_id uuid NOT NULL,payload jsonb NOT NULL DEFAULT '{}'::jsonb,redaction_version integer NOT NULL DEFAULT 1 CHECK(redaction_version>0),consented_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.support_agent_assignments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES public.support_cases(id) ON DELETE CASCADE,agent_user_id uuid NOT NULL,assignment_role text NOT NULL DEFAULT 'support_agent' CHECK(assignment_role IN ('support_agent','senior_support','support_engineering','billing_support')),assigned_by_id uuid,active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),ended_at timestamptz);
CREATE UNIQUE INDEX IF NOT EXISTS support_agent_assignments_one_active ON public.support_agent_assignments(case_id,agent_user_id) WHERE active;
CREATE TABLE IF NOT EXISTS public.support_attachments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES public.support_cases(id) ON DELETE CASCADE,created_by_id uuid NOT NULL,storage_path text NOT NULL UNIQUE,file_name text NOT NULL CHECK(char_length(file_name) BETWEEN 1 AND 255),mime_type text NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp','application/pdf','text/plain','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','video/mp4')),size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.support_incidents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL CHECK(char_length(title) BETWEEN 3 AND 180),status text NOT NULL DEFAULT 'INVESTIGATING' CHECK(status IN ('INVESTIGATING','IDENTIFIED','MONITORING','RESOLVED')),severity text NOT NULL DEFAULT 'P2' CHECK(severity IN ('P0','P1','P2','P3')),public_summary text,internal_summary text,created_by_id uuid,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz);
CREATE TABLE IF NOT EXISTS public.support_incident_cases (incident_id uuid NOT NULL REFERENCES public.support_incidents(id) ON DELETE CASCADE,case_id uuid NOT NULL REFERENCES public.support_cases(id) ON DELETE CASCADE,linked_by_id uuid,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(incident_id,case_id));
CREATE TABLE IF NOT EXISTS public.support_articles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slug text NOT NULL UNIQUE,title text NOT NULL CHECK(char_length(title) BETWEEN 3 AND 180),category text NOT NULL,audience text NOT NULL DEFAULT 'customer' CHECK(audience IN ('customer','staff','engineering')),status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),current_version integer NOT NULL DEFAULT 1 CHECK(current_version>0),product_version text,last_reviewed_at timestamptz,created_by_id uuid,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.support_article_versions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),article_id uuid NOT NULL REFERENCES public.support_articles(id) ON DELETE CASCADE,version integer NOT NULL CHECK(version>0),content text NOT NULL CHECK(char_length(content) BETWEEN 10 AND 50000),change_summary text,created_by_id uuid,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(article_id,version));
CREATE TABLE IF NOT EXISTS public.support_csat (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL UNIQUE REFERENCES public.support_cases(id) ON DELETE CASCADE,created_by_id uuid NOT NULL,solved boolean NOT NULL,rating smallint CHECK(rating BETWEEN 1 AND 5),comment text CHECK(comment IS NULL OR char_length(comment)<=2000),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.support_audit_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid REFERENCES public.support_cases(id) ON DELETE SET NULL,actor_user_id uuid,action text NOT NULL CHECK(char_length(action) BETWEEN 2 AND 120),target_type text,target_id text,metadata jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now());

CREATE INDEX IF NOT EXISTS support_cases_owner_updated_idx ON public.support_cases(created_by_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS support_cases_status_priority_idx ON public.support_cases(status,priority,updated_at DESC);
CREATE INDEX IF NOT EXISTS support_cases_company_idx ON public.support_cases(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS support_messages_case_created_idx ON public.support_messages(case_id,created_at);
CREATE INDEX IF NOT EXISTS support_events_case_created_idx ON public.support_case_events(case_id,created_at);
CREATE INDEX IF NOT EXISTS support_diagnostics_case_created_idx ON public.support_diagnostics(case_id,created_at DESC);
CREATE INDEX IF NOT EXISTS support_assignments_agent_active_idx ON public.support_agent_assignments(agent_user_id,active,created_at DESC);
CREATE INDEX IF NOT EXISTS support_attachments_case_idx ON public.support_attachments(case_id,created_at);
CREATE INDEX IF NOT EXISTS support_incidents_status_idx ON public.support_incidents(status,severity,updated_at DESC);
CREATE INDEX IF NOT EXISTS support_incident_cases_case_idx ON public.support_incident_cases(case_id);
CREATE INDEX IF NOT EXISTS support_articles_status_audience_idx ON public.support_articles(status,audience,category);
CREATE INDEX IF NOT EXISTS support_audit_case_created_idx ON public.support_audit_logs(case_id,created_at DESC);

ALTER TABLE public.support_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_agent_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_incident_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_article_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_csat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY support_cases_customer_select ON public.support_cases FOR SELECT TO authenticated USING ((SELECT auth.uid())=created_by_id);
CREATE POLICY support_cases_customer_insert ON public.support_cases FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid())=created_by_id AND status='NEW');
CREATE POLICY support_cases_staff_select ON public.support_cases FOR SELECT TO authenticated USING (public.is_support_admin() OR EXISTS (SELECT 1 FROM public.support_agent_assignments a WHERE a.case_id=support_cases.id AND a.agent_user_id=(SELECT auth.uid()) AND a.active));
CREATE POLICY support_messages_customer_select ON public.support_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.support_cases c WHERE c.id=support_messages.case_id AND c.created_by_id=(SELECT auth.uid())));
CREATE POLICY support_messages_customer_insert ON public.support_messages FOR INSERT TO authenticated WITH CHECK (sender_kind='customer' AND sender_user_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.support_cases c WHERE c.id=support_messages.case_id AND c.created_by_id=(SELECT auth.uid())));
CREATE POLICY support_messages_staff_select ON public.support_messages FOR SELECT TO authenticated USING (public.is_support_admin() OR EXISTS (SELECT 1 FROM public.support_agent_assignments a WHERE a.case_id=support_messages.case_id AND a.agent_user_id=(SELECT auth.uid()) AND a.active));
CREATE POLICY support_events_customer_select ON public.support_case_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.support_cases c WHERE c.id=support_case_events.case_id AND c.created_by_id=(SELECT auth.uid())));
CREATE POLICY support_events_staff_select ON public.support_case_events FOR SELECT TO authenticated USING (public.is_support_admin() OR EXISTS (SELECT 1 FROM public.support_agent_assignments a WHERE a.case_id=support_case_events.case_id AND a.agent_user_id=(SELECT auth.uid()) AND a.active));
CREATE POLICY support_diagnostics_customer_select ON public.support_diagnostics FOR SELECT TO authenticated USING (created_by_id=(SELECT auth.uid()));
CREATE POLICY support_diagnostics_customer_insert ON public.support_diagnostics FOR INSERT TO authenticated WITH CHECK (created_by_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.support_cases c WHERE c.id=support_diagnostics.case_id AND c.created_by_id=(SELECT auth.uid())));
CREATE POLICY support_diagnostics_staff_select ON public.support_diagnostics FOR SELECT TO authenticated USING (public.is_support_admin() OR EXISTS (SELECT 1 FROM public.support_agent_assignments a WHERE a.case_id=support_diagnostics.case_id AND a.agent_user_id=(SELECT auth.uid()) AND a.active));
CREATE POLICY support_assignments_agent_select ON public.support_agent_assignments FOR SELECT TO authenticated USING (agent_user_id=(SELECT auth.uid()) OR public.is_support_admin());
CREATE POLICY support_attachments_customer_select ON public.support_attachments FOR SELECT TO authenticated USING (created_by_id=(SELECT auth.uid()));
CREATE POLICY support_attachments_customer_insert ON public.support_attachments FOR INSERT TO authenticated WITH CHECK (created_by_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.support_cases c WHERE c.id=support_attachments.case_id AND c.created_by_id=(SELECT auth.uid())));
CREATE POLICY support_attachments_staff_select ON public.support_attachments FOR SELECT TO authenticated USING (public.is_support_admin() OR EXISTS (SELECT 1 FROM public.support_agent_assignments a WHERE a.case_id=support_attachments.case_id AND a.agent_user_id=(SELECT auth.uid()) AND a.active));
CREATE POLICY support_incidents_customer_select ON public.support_incidents FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.support_incident_cases ic JOIN public.support_cases c ON c.id=ic.case_id WHERE ic.incident_id=support_incidents.id AND c.created_by_id=(SELECT auth.uid())));
CREATE POLICY support_incidents_staff_select ON public.support_incidents FOR SELECT TO authenticated USING (public.is_support_staff());
CREATE POLICY support_incident_cases_customer_select ON public.support_incident_cases FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.support_cases c WHERE c.id=support_incident_cases.case_id AND c.created_by_id=(SELECT auth.uid())));
CREATE POLICY support_incident_cases_staff_select ON public.support_incident_cases FOR SELECT TO authenticated USING (public.is_support_staff());
CREATE POLICY support_articles_customer_select ON public.support_articles FOR SELECT TO authenticated USING (status='published' AND audience='customer');
CREATE POLICY support_articles_staff_select ON public.support_articles FOR SELECT TO authenticated USING (public.is_support_staff());
CREATE POLICY support_article_versions_customer_select ON public.support_article_versions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.support_articles a WHERE a.id=support_article_versions.article_id AND a.status='published' AND a.audience='customer' AND a.current_version=support_article_versions.version));
CREATE POLICY support_article_versions_staff_select ON public.support_article_versions FOR SELECT TO authenticated USING (public.is_support_staff());
CREATE POLICY support_csat_customer_select ON public.support_csat FOR SELECT TO authenticated USING (created_by_id=(SELECT auth.uid()));
CREATE POLICY support_csat_customer_insert ON public.support_csat FOR INSERT TO authenticated WITH CHECK (created_by_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.support_cases c WHERE c.id=support_csat.case_id AND c.created_by_id=(SELECT auth.uid()) AND c.status IN ('RESOLVED','CLOSED')));
CREATE POLICY support_csat_staff_select ON public.support_csat FOR SELECT TO authenticated USING (public.is_support_admin() OR EXISTS (SELECT 1 FROM public.support_agent_assignments a WHERE a.case_id=support_csat.case_id AND a.agent_user_id=(SELECT auth.uid()) AND a.active));
CREATE POLICY support_audit_admin_select ON public.support_audit_logs FOR SELECT TO authenticated USING (public.is_support_admin());

REVOKE ALL ON public.support_cases,public.support_messages,public.support_case_events,public.support_diagnostics,public.support_agent_assignments,public.support_attachments,public.support_incidents,public.support_incident_cases,public.support_articles,public.support_article_versions,public.support_csat,public.support_audit_logs FROM anon;
REVOKE UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.support_cases,public.support_messages,public.support_case_events,public.support_diagnostics,public.support_agent_assignments,public.support_attachments,public.support_incidents,public.support_incident_cases,public.support_articles,public.support_article_versions,public.support_csat,public.support_audit_logs FROM authenticated;
GRANT SELECT,INSERT ON public.support_cases,public.support_messages,public.support_diagnostics,public.support_attachments,public.support_csat TO authenticated;
GRANT SELECT ON public.support_case_events,public.support_agent_assignments,public.support_incidents,public.support_incident_cases,public.support_articles,public.support_article_versions,public.support_audit_logs TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('support-attachments','support-attachments',false,10485760,ARRAY['image/jpeg','image/png','image/webp','application/pdf','text/plain','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','video/mp4']::text[])
ON CONFLICT(id) DO UPDATE SET public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
CREATE POLICY support_storage_customer_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='support-attachments' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY support_storage_customer_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id='support-attachments' AND ((storage.foldername(name))[1]=(SELECT auth.uid())::text OR public.is_support_admin() OR EXISTS (SELECT 1 FROM public.support_attachments sa JOIN public.support_agent_assignments aa ON aa.case_id=sa.case_id WHERE sa.storage_path=storage.objects.name AND aa.agent_user_id=(SELECT auth.uid()) AND aa.active)));
CREATE POLICY support_storage_customer_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id='support-attachments' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);