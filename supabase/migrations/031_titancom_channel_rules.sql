-- TitanCom: channel expiry for free users + sole-admin semantics.
-- Apply on production after 030.

BEGIN;

ALTER TABLE public.titan_comms_channels
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMENT ON COLUMN public.titan_comms_channels.expires_at IS
  'When set, channel is daily/ephemeral (free tier). NULL = persistent (Premium).';

-- Creator remains sole admin: members may not promote themselves.
CREATE OR REPLACE FUNCTION public.titan_comms_prevent_admin_transfer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IN ('admin', 'owner') THEN
    IF EXISTS (
      SELECT 1 FROM public.titan_comms_channels c
      WHERE c.id = NEW.channel_id
        AND c.created_by_id IS DISTINCT FROM NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Only the channel creator can be admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS titan_comms_members_admin_guard ON public.titan_comms_members;
CREATE TRIGGER titan_comms_members_admin_guard
  BEFORE INSERT OR UPDATE OF role ON public.titan_comms_members
  FOR EACH ROW
  EXECUTE FUNCTION public.titan_comms_prevent_admin_transfer();

COMMIT;
