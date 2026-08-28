-- Recovered from the authoritative pre-Titan-Attention Supabase migration ledger.
-- Original ledger version: 20260813182734 (context_threads).

CREATE TABLE IF NOT EXISTS public.titan_threads(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,type TEXT NOT NULL,label TEXT NOT NULL,thread_key TEXT NOT NULL,
 entity_id TEXT,metadata JSONB NOT NULL DEFAULT '{}'::jsonb,archived BOOLEAN NOT NULL DEFAULT false,
 created_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,UNIQUE(user_id,thread_key));
CREATE TABLE IF NOT EXISTS public.titan_thread_items(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 thread_id UUID NOT NULL REFERENCES public.titan_threads(id) ON DELETE CASCADE,memory_node_id UUID NOT NULL REFERENCES public.titan_memory_nodes(id) ON DELETE CASCADE,
 link_confidence NUMERIC(4,3) NOT NULL DEFAULT 1 CHECK(link_confidence>=0 AND link_confidence<=1),link_reason TEXT NOT NULL DEFAULT 'explicit',
 created_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,UNIQUE(thread_id,memory_node_id));
CREATE INDEX IF NOT EXISTS idx_titan_threads_user_type ON public.titan_threads(user_id,type,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_titan_thread_items_thread ON public.titan_thread_items(thread_id,created_at DESC);
ALTER TABLE public.titan_threads ENABLE ROW LEVEL SECURITY;ALTER TABLE public.titan_thread_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS titan_threads_owner_all ON public.titan_threads;CREATE POLICY titan_threads_owner_all ON public.titan_threads FOR ALL TO authenticated USING(user_id=auth.uid() OR public.is_admin()) WITH CHECK(user_id=auth.uid() AND created_by_id=auth.uid());
DROP POLICY IF EXISTS titan_thread_items_owner_all ON public.titan_thread_items;CREATE POLICY titan_thread_items_owner_all ON public.titan_thread_items FOR ALL TO authenticated USING(user_id=auth.uid() OR public.is_admin()) WITH CHECK(user_id=auth.uid() AND created_by_id=auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.titan_threads, public.titan_thread_items TO authenticated;
NOTIFY pgrst,'reload schema';
