-- TitanOS three-sided work ecosystem: Job Seeker · Independent Work · Business
-- Additive migration. Workspace selection is intentionally separate from billing entitlements.

BEGIN;

-- ---------------------------------------------------------------------------
-- Workspace identity (product UX only; NEVER subscription entitlement)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS enabled_workspaces text[] NOT NULL DEFAULT ARRAY['job_seeker']::text[],
  ADD COLUMN IF NOT EXISTS active_workspace text NOT NULL DEFAULT 'job_seeker';

UPDATE public.profiles
SET enabled_workspaces = CASE
      WHEN account_type = 'business' THEN ARRAY['business']::text[]
      ELSE ARRAY['job_seeker']::text[]
    END,
    active_workspace = CASE
      WHEN account_type = 'business' THEN 'business'
      ELSE 'job_seeker'
    END
WHERE enabled_workspaces = ARRAY['job_seeker']::text[]
  AND active_workspace = 'job_seeker';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_enabled_workspaces_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_enabled_workspaces_valid CHECK (
  cardinality(enabled_workspaces) >= 1
  AND enabled_workspaces <@ ARRAY['job_seeker','self_employed','business']::text[]
);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_active_workspace_valid;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_active_workspace_valid CHECK (
  active_workspace = ANY (ARRAY['job_seeker','self_employed','business']::text[])
  AND active_workspace = ANY (enabled_workspaces)
);

COMMENT ON COLUMN public.profiles.enabled_workspaces IS
  'Enabled Titan workspaces. Product UX only; MUST NOT grant subscription entitlements.';
COMMENT ON COLUMN public.profiles.active_workspace IS
  'Currently active isolated workspace: job_seeker | self_employed | business. Product UX only.';

-- ---------------------------------------------------------------------------
-- Independent worker Service Profile
-- Public profile intentionally stores only general service area, never home address
-- or private precise search coordinates.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  display_name text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  services text[] NOT NULL DEFAULT '{}',
  skills text[] NOT NULL DEFAULT '{}',
  service_city text NOT NULL DEFAULT '',
  service_state text NOT NULL DEFAULT '',
  service_radius_miles integer NOT NULL DEFAULT 30 CHECK (service_radius_miles BETWEEN 1 AND 500),
  pricing_mode text NOT NULL DEFAULT 'quote' CHECK (pricing_mode IN ('hourly','flat','starting_at','quote')),
  hourly_rate numeric NOT NULL DEFAULT 0 CHECK (hourly_rate >= 0),
  starting_price numeric NOT NULL DEFAULT 0 CHECK (starting_price >= 0),
  availability text NOT NULL DEFAULT 'available' CHECK (availability IN ('available','busy','offline')),
  availability_tags text[] NOT NULL DEFAULT '{}',
  licenses text[] NOT NULL DEFAULT '{}',
  certifications text[] NOT NULL DEFAULT '{}',
  equipment text[] NOT NULL DEFAULT '{}',
  insured boolean NOT NULL DEFAULT false,
  business_name text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  business_contact text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS service_profiles_discovery_idx
  ON public.service_profiles (published, availability, service_state, service_city)
  WHERE published = true;

ALTER TABLE public.service_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_profiles_select ON public.service_profiles;
CREATE POLICY service_profiles_select ON public.service_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR published = true);

DROP POLICY IF EXISTS service_profiles_insert ON public.service_profiles;
CREATE POLICY service_profiles_insert ON public.service_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND created_by_id = auth.uid());

DROP POLICY IF EXISTS service_profiles_update ON public.service_profiles;
CREATE POLICY service_profiles_update ON public.service_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND created_by_id = auth.uid());

DROP POLICY IF EXISTS service_profiles_delete ON public.service_profiles;
CREATE POLICY service_profiles_delete ON public.service_profiles
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.service_profiles IS
  'Opt-in public profile for independent work. Never store or expose exact home address here.';

-- ---------------------------------------------------------------------------
-- Explicit relationship type on opportunities
-- Existing rows are legacy and remain employment-compatible until explicitly edited.
-- ---------------------------------------------------------------------------
ALTER TABLE public.hire_jobs
  ADD COLUMN IF NOT EXISTS relationship_type text NOT NULL DEFAULT 'employment';

ALTER TABLE public.hire_jobs DROP CONSTRAINT IF EXISTS hire_jobs_relationship_type_valid;
ALTER TABLE public.hire_jobs ADD CONSTRAINT hire_jobs_relationship_type_valid CHECK (
  relationship_type IN ('employment','contract','customer_request')
);

CREATE INDEX IF NOT EXISTS hire_jobs_relationship_status_idx
  ON public.hire_jobs (relationship_type, status, created_at DESC);

COMMENT ON COLUMN public.hire_jobs.relationship_type IS
  'Employment = employee relationship; contract = independent help/subcontracting; customer_request = customer seeking an independent service.';

-- ---------------------------------------------------------------------------
-- Engagement raw events: informational trust signal only.
-- This table is server-written and append-oriented. It MUST NOT be queried by
-- qualification matching, eligibility filters, auto-rejection, or candidate ranking.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.engagement_interaction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_kind text NOT NULL CHECK (subject_kind IN ('worker','business')),
  counterparty_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id text,
  opportunity_id uuid REFERENCES public.hire_jobs(id) ON DELETE SET NULL,
  interaction_type text NOT NULL CHECK (interaction_type IN (
    'opportunity_response','employer_response','interview_confirmation','interview_outcome',
    'reschedule','cancellation','hiring_status_update','conversation_response'
  )),
  status text NOT NULL CHECK (status IN (
    'responded','confirmed','attended','declined','not_interested',
    'candidate_cancelled','candidate_rescheduled','employer_cancelled','employer_rescheduled',
    'mutually_rescheduled','no_response','no_show','technical_issue','disputed','completed'
  )),
  attribution text NOT NULL DEFAULT 'system' CHECK (attribution IN ('candidate','business','mutual','system','unknown')),
  expected_by timestamptz,
  completed_at timestamptz,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  disputed boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS engagement_events_subject_time_idx
  ON public.engagement_interaction_events (subject_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS engagement_events_company_time_idx
  ON public.engagement_interaction_events (company_id, occurred_at DESC)
  WHERE company_id IS NOT NULL;

ALTER TABLE public.engagement_interaction_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS engagement_events_participant_select ON public.engagement_interaction_events;
CREATE POLICY engagement_events_participant_select ON public.engagement_interaction_events
  FOR SELECT TO authenticated
  USING (subject_user_id = auth.uid() OR counterparty_user_id = auth.uid());

-- No INSERT/UPDATE/DELETE client policy by design: verified server workflows own events.
COMMENT ON TABLE public.engagement_interaction_events IS
  'Server-owned raw interaction events for explainable Engagement. Never an employment qualification/eligibility/ranking input.';

CREATE TABLE IF NOT EXISTS public.engagement_event_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.engagement_interaction_events(id) ON DELETE CASCADE,
  raised_by_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','rejected','resolved')),
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE(event_id, raised_by_id)
);

ALTER TABLE public.engagement_event_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS engagement_disputes_select_own ON public.engagement_event_disputes;
CREATE POLICY engagement_disputes_select_own ON public.engagement_event_disputes
  FOR SELECT TO authenticated
  USING (raised_by_id = auth.uid());

DROP POLICY IF EXISTS engagement_disputes_insert_participant ON public.engagement_event_disputes;
CREATE POLICY engagement_disputes_insert_participant ON public.engagement_event_disputes
  FOR INSERT TO authenticated
  WITH CHECK (
    raised_by_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.engagement_interaction_events e
      WHERE e.id = event_id
        AND (e.subject_user_id = auth.uid() OR e.counterparty_user_id = auth.uid())
    )
  );

COMMENT ON TABLE public.engagement_event_disputes IS
  'User challenges to engagement source events. Base events remain server-owned/auditable.';

COMMIT;
