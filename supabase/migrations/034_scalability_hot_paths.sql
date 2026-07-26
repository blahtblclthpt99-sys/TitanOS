-- Scalability hot-path indexes + cloud driver trip journal foundation.
-- Assumes millions of jobs/trips/notifications; indexes match RLS/filter columns.

-- ── Customer-scoped history (CustomerDetail, CRM) ──────────────────────────
CREATE INDEX IF NOT EXISTS jobs_customer_scheduled_idx
  ON public.jobs (customer_id, scheduled_date DESC NULLS LAST)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS invoices_customer_created_idx
  ON public.invoices (customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS estimates_customer_created_idx
  ON public.estimates (customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

-- ── Owner timelines ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS jobs_owner_created_idx
  ON public.jobs (created_by_id, created_at DESC);

CREATE INDEX IF NOT EXISTS jobs_owner_status_scheduled_idx
  ON public.jobs (created_by_id, status, scheduled_date DESC NULLS LAST);

-- ── Unread notification badge (head/count hot path) ────────────────────────
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- ── Cloud driver trip journal (device cache remains; sync when online) ─────
CREATE TABLE IF NOT EXISTS public.driver_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'completed',
  miles NUMERIC NOT NULL DEFAULT 0,
  earnings NUMERIC,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT driver_trips_user_client_uidx UNIQUE (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS driver_trips_user_started_idx
  ON public.driver_trips (user_id, started_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS driver_trips_user_created_idx
  ON public.driver_trips (user_id, created_at DESC);

ALTER TABLE public.driver_trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS driver_trips_own_select ON public.driver_trips;
CREATE POLICY driver_trips_own_select ON public.driver_trips
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS driver_trips_own_insert ON public.driver_trips;
CREATE POLICY driver_trips_own_insert ON public.driver_trips
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS driver_trips_own_update ON public.driver_trips;
CREATE POLICY driver_trips_own_update ON public.driver_trips
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS driver_trips_own_delete ON public.driver_trips;
CREATE POLICY driver_trips_own_delete ON public.driver_trips
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.driver_trips IS
  'Cloud trip journal for multi-device / scale. Local MAX_JOURNAL is a cache ring, not the system of record once synced.';
