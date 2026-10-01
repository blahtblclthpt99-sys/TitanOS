-- Harden marketplace message updates against recipient identity/body forgery.
--
-- The original trigger classified the actor from NEW.sender_id / NEW.created_by_id.
-- A recipient could therefore submit an UPDATE that first changed sender_id to their
-- own uid and bypass the recipient-only body protection in the same statement.
--
-- Browser clients now have immutable message identity/routing metadata. The
-- original sender/creator may edit the body but cannot forge recipient read state;
-- the original recipient may update read_at but cannot rewrite message content.
-- Service-role and admin maintenance paths retain their existing authority.

BEGIN;

CREATE OR REPLACE FUNCTION public.protect_message_body()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid := auth.uid();
  actor_text text;
BEGIN
  IF TG_OP <> 'UPDATE'
     OR COALESCE(auth.role(), '') = 'service_role'
     OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user required to update messages';
  END IF;

  actor_text := actor_id::text;

  -- Classify authority from the stored row, never caller-controlled NEW values.
  -- Message identity/routing metadata is immutable to ordinary browser clients.
  NEW.id := OLD.id;
  NEW.created_at := OLD.created_at;
  NEW.created_by_id := OLD.created_by_id;
  NEW.listing_id := OLD.listing_id;
  NEW.hire_job_id := OLD.hire_job_id;
  NEW.thread_id := OLD.thread_id;
  NEW.sender_id := OLD.sender_id;
  NEW.recipient_id := OLD.recipient_id;

  IF OLD.sender_id = actor_text OR OLD.created_by_id = actor_id THEN
    -- The sender owns message content, but the recipient owns read state.
    NEW.read_at := OLD.read_at;
    RETURN NEW;
  END IF;

  IF OLD.recipient_id = actor_text THEN
    -- Recipients may acknowledge/read a message, but may not rewrite it.
    NEW.body := OLD.body;
    RETURN NEW;
  END IF;

  -- RLS should reject this before the trigger executes. Keep the trigger itself
  -- fail-closed so future policy changes cannot silently widen mutation authority.
  RAISE EXCEPTION 'Message update not authorized';
END;
$$;

-- CREATE OR REPLACE preserves the function ACL, but restate the server-only
-- direct-execution boundary so this migration remains safe when applied alone.
REVOKE ALL ON FUNCTION public.protect_message_body() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_message_body() TO service_role;

COMMIT;
