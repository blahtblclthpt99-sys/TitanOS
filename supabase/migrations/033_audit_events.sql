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

-- No INSERT/UPDATE/DELETE policies for authenticated — service role only.
COMMENT ON TABLE public.audit_events IS 'Append-only ops audit; metadata must not contain secrets.';
