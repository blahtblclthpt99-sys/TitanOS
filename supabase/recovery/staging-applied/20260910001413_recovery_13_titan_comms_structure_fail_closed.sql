CREATE TABLE IF NOT EXISTS public.titan_comms_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text,
  name text NOT NULL,
  description text DEFAULT '',
  kind text NOT NULL DEFAULT 'team' CHECK (kind IN ('public','private','team','job','direct','emergency')),
  is_password_protected boolean NOT NULL DEFAULT false,
  created_by_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id uuid,
  job_id uuid,
  archived_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS titan_comms_channels_slug_uidx ON public.titan_comms_channels(slug) WHERE slug IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.titan_comms_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.titan_comms_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member','listener')),
  voice_status text NOT NULL DEFAULT 'available' CHECK (voice_status IN ('available','busy','driving','offline','emergency','dnd')),
  share_location boolean NOT NULL DEFAULT false,
  last_heard_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id,user_id)
);
CREATE TABLE IF NOT EXISTS public.titan_comms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.titan_comms_channels(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','system','sos','voice_note','file')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS titan_comms_messages_channel_created_idx ON public.titan_comms_messages(channel_id,created_at DESC);
ALTER TABLE public.titan_comms_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titan_comms_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titan_comms_messages ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.titan_comms_prevent_admin_transfer()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.role IN ('admin','owner') THEN
    IF EXISTS (SELECT 1 FROM public.titan_comms_channels c WHERE c.id=NEW.channel_id AND c.created_by_id IS DISTINCT FROM NEW.user_id) THEN
      RAISE EXCEPTION 'Only the channel creator can be admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS titan_comms_members_admin_guard ON public.titan_comms_members;
CREATE TRIGGER titan_comms_members_admin_guard BEFORE INSERT OR UPDATE OF role ON public.titan_comms_members FOR EACH ROW EXECUTE FUNCTION public.titan_comms_prevent_admin_transfer();
REVOKE ALL ON FUNCTION public.titan_comms_prevent_admin_transfer() FROM PUBLIC;
COMMENT ON TABLE public.titan_comms_members IS 'Recovery staging: client membership policies intentionally withheld until database-integrity lockdown is applied.';