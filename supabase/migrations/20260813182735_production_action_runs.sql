-- Recovered from the authoritative pre-Titan-Attention Supabase migration ledger.
-- Original ledger version: 20260813182735 (production_action_runs).

CREATE TABLE IF NOT EXISTS public.titan_action_runs(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 plan_id TEXT,
 plan_title TEXT,
 command TEXT,
 device_id TEXT,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN('queued','running','waiting_approval','waiting_integration','completed','failed','cancelled')),
 current_action_id TEXT,
 completed_action_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
 failed_action_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
 blocked_action_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
 retry_count INTEGER NOT NULL DEFAULT 0,
 checkpoint JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS public.titan_action_idempotency(
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 idempotency_key TEXT NOT NULL,
 plan_id TEXT NOT NULL,
 action_id TEXT NOT NULL,
 result JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 UNIQUE(user_id,idempotency_key));
CREATE INDEX IF NOT EXISTS idx_titan_runs_user_status ON public.titan_action_runs(user_id,status,updated_at DESC);
ALTER TABLE public.titan_action_runs ENABLE ROW LEVEL SECURITY;ALTER TABLE public.titan_action_idempotency ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS titan_runs_owner_all ON public.titan_action_runs;
CREATE POLICY titan_runs_owner_all ON public.titan_action_runs FOR ALL TO authenticated USING(user_id=auth.uid() OR public.is_admin()) WITH CHECK(user_id=auth.uid() AND created_by_id=auth.uid());
DROP POLICY IF EXISTS titan_idempotency_owner_all ON public.titan_action_idempotency;
CREATE POLICY titan_idempotency_owner_all ON public.titan_action_idempotency FOR ALL TO authenticated USING(user_id=auth.uid() OR public.is_admin()) WITH CHECK(user_id=auth.uid() AND created_by_id=auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.titan_action_runs, public.titan_action_idempotency TO authenticated;
NOTIFY pgrst,'reload schema';
