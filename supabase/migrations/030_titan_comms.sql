-- TitanComms MVP — push-to-talk channels, members, text messages.
-- Live audio uses Supabase Realtime broadcast + WebRTC (client-side).

BEGIN;

CREATE TABLE IF NOT EXISTS public.titan_comms_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text,
  name text NOT NULL,
  description text DEFAULT '',
  kind text NOT NULL DEFAULT 'team'
    CHECK (kind IN ('public', 'private', 'team', 'job', 'direct', 'emergency')),
  is_password_protected boolean NOT NULL DEFAULT false,
  password_hash text,
  created_by_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  company_id uuid,
  job_id uuid,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS titan_comms_channels_slug_uidx
  ON public.titan_comms_channels (slug)
  WHERE slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.titan_comms_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.titan_comms_channels (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member', 'listener')),
  voice_status text NOT NULL DEFAULT 'available'
    CHECK (voice_status IN ('available', 'busy', 'driving', 'offline', 'emergency', 'dnd')),
  share_location boolean NOT NULL DEFAULT false,
  last_heard_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.titan_comms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.titan_comms_channels (id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  message_type text NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'system', 'sos', 'voice_note', 'file')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS titan_comms_messages_channel_created_idx
  ON public.titan_comms_messages (channel_id, created_at DESC);

ALTER TABLE public.titan_comms_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titan_comms_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titan_comms_messages ENABLE ROW LEVEL SECURITY;

-- Members can see channels they belong to; public channels readable by authenticated users
CREATE POLICY titan_comms_channels_select ON public.titan_comms_channels
  FOR SELECT TO authenticated
  USING (
    kind = 'public'
    OR created_by_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.titan_comms_members m
      WHERE m.channel_id = titan_comms_channels.id AND m.user_id = auth.uid()
    )
    OR public.is_admin()
  );

CREATE POLICY titan_comms_channels_insert ON public.titan_comms_channels
  FOR INSERT TO authenticated
  WITH CHECK (created_by_id = auth.uid());

CREATE POLICY titan_comms_channels_update ON public.titan_comms_channels
  FOR UPDATE TO authenticated
  USING (
    created_by_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.titan_comms_members m
      WHERE m.channel_id = titan_comms_channels.id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
    OR public.is_admin()
  );

CREATE POLICY titan_comms_members_select ON public.titan_comms_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.titan_comms_members m
      WHERE m.channel_id = titan_comms_members.channel_id AND m.user_id = auth.uid()
    )
    OR public.is_admin()
  );

CREATE POLICY titan_comms_members_insert ON public.titan_comms_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY titan_comms_members_update ON public.titan_comms_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY titan_comms_members_delete ON public.titan_comms_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY titan_comms_messages_select ON public.titan_comms_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.titan_comms_members m
      WHERE m.channel_id = titan_comms_messages.channel_id AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.titan_comms_channels c
      WHERE c.id = titan_comms_messages.channel_id AND c.kind = 'public'
    )
    OR public.is_admin()
  );

CREATE POLICY titan_comms_messages_insert ON public.titan_comms_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

COMMIT;
