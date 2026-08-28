-- Recovered from the authoritative pre-Titan-Attention Supabase migration ledger.
-- Original ledger version: 20260813182732 (titan_memory_and_rules).

CREATE TABLE IF NOT EXISTS public.titan_rules(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,name TEXT NOT NULL,command TEXT NOT NULL,trigger_type TEXT NOT NULL,
 conditions JSONB NOT NULL DEFAULT '{}'::jsonb,actions JSONB NOT NULL DEFAULT '[]'::jsonb,enabled BOOLEAN NOT NULL DEFAULT true,
 requires_approval BOOLEAN NOT NULL DEFAULT false,created_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS public.titan_rule_runs(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 rule_id UUID NOT NULL REFERENCES public.titan_rules(id) ON DELETE CASCADE,event_type TEXT NOT NULL,event JSONB NOT NULL DEFAULT '{}'::jsonb,
 matched BOOLEAN NOT NULL DEFAULT false,result JSONB NOT NULL DEFAULT '{}'::jsonb,created_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS public.titan_memory_nodes(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,type TEXT NOT NULL,label TEXT NOT NULL,data JSONB NOT NULL DEFAULT '{}'::jsonb,
 source TEXT NOT NULL DEFAULT 'user',confidence NUMERIC(4,3) NOT NULL DEFAULT 1 CHECK(confidence>=0 AND confidence<=1),
 archived BOOLEAN NOT NULL DEFAULT false,created_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS public.titan_memory_edges(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 from_node_id UUID NOT NULL REFERENCES public.titan_memory_nodes(id) ON DELETE CASCADE,to_node_id UUID NOT NULL REFERENCES public.titan_memory_nodes(id) ON DELETE CASCADE,
 relationship_type TEXT NOT NULL,metadata JSONB NOT NULL DEFAULT '{}'::jsonb,created_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS idx_titan_rules_user_enabled ON public.titan_rules(user_id,enabled,trigger_type);
CREATE INDEX IF NOT EXISTS idx_titan_memory_user_type ON public.titan_memory_nodes(user_id,type,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_titan_edges_from ON public.titan_memory_edges(user_id,from_node_id);
ALTER TABLE public.titan_rules ENABLE ROW LEVEL SECURITY;ALTER TABLE public.titan_rule_runs ENABLE ROW LEVEL SECURITY;ALTER TABLE public.titan_memory_nodes ENABLE ROW LEVEL SECURITY;ALTER TABLE public.titan_memory_edges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS titan_rules_owner_all ON public.titan_rules;CREATE POLICY titan_rules_owner_all ON public.titan_rules FOR ALL TO authenticated USING(user_id=auth.uid() OR public.is_admin()) WITH CHECK(user_id=auth.uid() AND created_by_id=auth.uid());
DROP POLICY IF EXISTS titan_rule_runs_owner_all ON public.titan_rule_runs;CREATE POLICY titan_rule_runs_owner_all ON public.titan_rule_runs FOR ALL TO authenticated USING(user_id=auth.uid() OR public.is_admin()) WITH CHECK(user_id=auth.uid() AND created_by_id=auth.uid());
DROP POLICY IF EXISTS titan_memory_nodes_owner_all ON public.titan_memory_nodes;CREATE POLICY titan_memory_nodes_owner_all ON public.titan_memory_nodes FOR ALL TO authenticated USING(user_id=auth.uid() OR public.is_admin()) WITH CHECK(user_id=auth.uid() AND created_by_id=auth.uid());
DROP POLICY IF EXISTS titan_memory_edges_owner_all ON public.titan_memory_edges;CREATE POLICY titan_memory_edges_owner_all ON public.titan_memory_edges FOR ALL TO authenticated USING(user_id=auth.uid() OR public.is_admin()) WITH CHECK(user_id=auth.uid() AND created_by_id=auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.titan_rules, public.titan_rule_runs, public.titan_memory_nodes, public.titan_memory_edges TO authenticated;
NOTIFY pgrst,'reload schema';
