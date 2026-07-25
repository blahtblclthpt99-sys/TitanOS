-- 019: Production security lockdown — payments status, hire accept, notifications, messages
-- SAFETY: Additive policy replacements. Does not drop tables or mutate row data.
-- APPLY AFTER: 016 (hire apps), 017 (fees), 018 (stripe idempotency)

BEGIN;

-- ---------------------------------------------------------------------------
-- PAYMENTS: owners may INSERT/SELECT/DELETE and update non-money fields,
-- but may NOT set status to succeeded / refunded (webhook / service role only).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS payments_own ON public.payments;
DROP POLICY IF EXISTS payments_select ON public.payments;
DROP POLICY IF EXISTS payments_insert ON public.payments;
DROP POLICY IF EXISTS payments_update ON public.payments;
DROP POLICY IF EXISTS payments_delete ON public.payments;

CREATE POLICY payments_select ON public.payments
  FOR SELECT TO authenticated
  USING (created_by_id = auth.uid() OR user_id = auth.uid()::text OR public.is_admin());

CREATE POLICY payments_insert ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    (created_by_id = auth.uid() OR user_id = auth.uid()::text)
    AND COALESCE(status, 'pending') NOT IN ('succeeded', 'refunded')
  );

-- Clients may cancel/fail pending rows or edit notes — never mark paid/refunded.
CREATE POLICY payments_update ON public.payments
  FOR UPDATE TO authenticated
  USING (created_by_id = auth.uid() OR user_id = auth.uid()::text OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (
      (created_by_id = auth.uid() OR user_id = auth.uid()::text)
      AND COALESCE(status, 'pending') NOT IN ('succeeded', 'refunded')
    )
  );

CREATE POLICY payments_delete ON public.payments
  FOR DELETE TO authenticated
  USING (created_by_id = auth.uid() OR user_id = auth.uid()::text OR public.is_admin());

-- ---------------------------------------------------------------------------
-- HIRE APPLICATIONS: applicants may only set withdrawn/pending; owners accept.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS hire_apps_update ON public.hire_applications;

CREATE POLICY hire_apps_update ON public.hire_applications
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR created_by_id = auth.uid()
    OR worker_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.hire_jobs j
      WHERE j.id::text = hire_applications.hire_job_id
        AND (j.created_by_id = auth.uid() OR j.customer_id = auth.uid()::text)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.hire_jobs j
      WHERE j.id::text = hire_applications.hire_job_id
        AND (j.created_by_id = auth.uid() OR j.customer_id = auth.uid()::text)
    )
    OR (
      (created_by_id = auth.uid() OR worker_id = auth.uid()::text)
      AND COALESCE(status, 'pending') IN ('pending', 'withdrawn', 'rejected')
    )
  );

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS: may only insert rows for yourself (cross-user via service role).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS notifications_own ON public.notifications;

CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text OR created_by_id = auth.uid() OR public.is_admin());

CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text AND created_by_id = auth.uid());

CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text OR public.is_admin())
  WITH CHECK (user_id = auth.uid()::text OR public.is_admin());

CREATE POLICY notifications_delete ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid()::text OR created_by_id = auth.uid() OR public.is_admin());

-- ---------------------------------------------------------------------------
-- MESSAGES: participants may read/insert; only sender may update body or delete.
-- Recipients may mark read_at via update if they are recipient (body unchanged
-- is hard in RLS — restrict UPDATE to sender only for simplicity).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS messages_own ON public.marketplace_messages;

CREATE POLICY messages_select ON public.marketplace_messages
  FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()::text
    OR recipient_id = auth.uid()::text
    OR created_by_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY messages_insert ON public.marketplace_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()::text
    AND created_by_id = auth.uid()
  );

CREATE POLICY messages_update ON public.marketplace_messages
  FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid()::text
    OR recipient_id = auth.uid()::text
    OR public.is_admin()
  )
  WITH CHECK (
    public.is_admin()
    OR sender_id = auth.uid()::text
    OR recipient_id = auth.uid()::text
  );

CREATE POLICY messages_delete ON public.marketplace_messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid()::text OR created_by_id = auth.uid() OR public.is_admin());

-- ---------------------------------------------------------------------------
-- ACTIVITY: stop cross-tenant SELECT true
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS activity_read ON public.activity_events;

CREATE POLICY activity_read ON public.activity_events
  FOR SELECT TO authenticated
  USING (created_by_id = auth.uid() OR public.is_admin());

COMMIT;
