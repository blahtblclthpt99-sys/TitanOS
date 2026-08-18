-- Engagement event provenance for TitanOS work opportunities.
-- Raw engagement events are derived from authoritative application state, not
-- user-supplied score inputs. This preserves the informational-only trust model.

BEGIN;

CREATE OR REPLACE FUNCTION public.record_hire_application_engagement_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  worker_uuid uuid;
  owner_uuid uuid;
  relationship text;
BEGIN
  BEGIN
    worker_uuid := NEW.worker_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NEW;
  END;

  SELECT
    COALESCE(
      CASE
        WHEN hj.customer_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          THEN hj.customer_id::uuid
        ELSE NULL
      END,
      hj.created_by_id
    ),
    COALESCE(hj.relationship_type, 'employment')
  INTO owner_uuid, relationship
  FROM public.hire_jobs hj
  WHERE hj.id = NEW.hire_job_id::uuid;

  IF NOT EXISTS (
    SELECT 1
    FROM public.engagement_interaction_events e
    WHERE e.subject_user_id = worker_uuid
      AND e.opportunity_id = NEW.hire_job_id::uuid
      AND e.interaction_type = 'opportunity_response'
      AND e.metadata->>'application_id' = NEW.id::text
  ) THEN
    INSERT INTO public.engagement_interaction_events (
      subject_user_id,
      subject_kind,
      counterparty_user_id,
      opportunity_id,
      interaction_type,
      status,
      attribution,
      completed_at,
      occurred_at,
      metadata
    ) VALUES (
      worker_uuid,
      'worker',
      owner_uuid,
      NEW.hire_job_id::uuid,
      'opportunity_response',
      'responded',
      'candidate',
      COALESCE(NEW.created_at, now()),
      COALESCE(NEW.created_at, now()),
      jsonb_build_object(
        'application_id', NEW.id::text,
        'application_status', COALESCE(NEW.status, 'pending'),
        'relationship_type', relationship,
        'verified_from', 'hire_applications_insert'
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN invalid_text_representation THEN
  -- Legacy malformed foreign identifiers should never break the application.
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.record_hire_application_engagement_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_hire_application_engagement_insert() FROM anon;
REVOKE ALL ON FUNCTION public.record_hire_application_engagement_insert() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_hire_application_engagement_insert() TO service_role;

DROP TRIGGER IF EXISTS hire_applications_engagement_insert ON public.hire_applications;
CREATE TRIGGER hire_applications_engagement_insert
AFTER INSERT ON public.hire_applications
FOR EACH ROW
EXECUTE FUNCTION public.record_hire_application_engagement_insert();

CREATE OR REPLACE FUNCTION public.record_hire_application_engagement_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  worker_uuid uuid;
  owner_uuid uuid;
  relationship text;
  subject_uuid uuid;
  subject_kind_value text;
  counterparty_uuid uuid;
  event_status text;
  event_attribution text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  BEGIN
    worker_uuid := NEW.worker_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    worker_uuid := NULL;
  END;

  SELECT
    COALESCE(
      CASE
        WHEN hj.customer_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          THEN hj.customer_id::uuid
        ELSE NULL
      END,
      hj.created_by_id
    ),
    COALESCE(hj.relationship_type, 'employment')
  INTO owner_uuid, relationship
  FROM public.hire_jobs hj
  WHERE hj.id = NEW.hire_job_id::uuid;

  IF NEW.status IN ('accepted', 'rejected') AND owner_uuid IS NOT NULL THEN
    -- Accepted and rejected are both evidence that the business closed the loop.
    -- The outcome itself does not alter the worker's Engagement standing.
    subject_uuid := owner_uuid;
    subject_kind_value := 'business';
    counterparty_uuid := worker_uuid;
    event_status := 'responded';
    event_attribution := 'business';
  ELSIF NEW.status = 'withdrawn' AND worker_uuid IS NOT NULL THEN
    -- Withdrawing is responsible communication, not a negative event.
    subject_uuid := worker_uuid;
    subject_kind_value := 'worker';
    counterparty_uuid := owner_uuid;
    event_status := 'declined';
    event_attribution := 'candidate';
  ELSE
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.engagement_interaction_events e
    WHERE e.subject_user_id = subject_uuid
      AND e.opportunity_id = NEW.hire_job_id::uuid
      AND e.interaction_type = 'hiring_status_update'
      AND e.metadata->>'application_id' = NEW.id::text
      AND e.metadata->>'application_status' = NEW.status
  ) THEN
    INSERT INTO public.engagement_interaction_events (
      subject_user_id,
      subject_kind,
      counterparty_user_id,
      opportunity_id,
      interaction_type,
      status,
      attribution,
      completed_at,
      occurred_at,
      metadata
    ) VALUES (
      subject_uuid,
      subject_kind_value,
      counterparty_uuid,
      NEW.hire_job_id::uuid,
      'hiring_status_update',
      event_status,
      event_attribution,
      COALESCE(NEW.updated_at, now()),
      COALESCE(NEW.updated_at, now()),
      jsonb_build_object(
        'application_id', NEW.id::text,
        'application_status', NEW.status,
        'previous_application_status', OLD.status,
        'relationship_type', relationship,
        'verified_from', 'hire_applications_status_update'
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.record_hire_application_engagement_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_hire_application_engagement_status() FROM anon;
REVOKE ALL ON FUNCTION public.record_hire_application_engagement_status() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_hire_application_engagement_status() TO service_role;

DROP TRIGGER IF EXISTS hire_applications_engagement_status ON public.hire_applications;
CREATE TRIGGER hire_applications_engagement_status
AFTER UPDATE OF status ON public.hire_applications
FOR EACH ROW
EXECUTE FUNCTION public.record_hire_application_engagement_status();

COMMIT;
