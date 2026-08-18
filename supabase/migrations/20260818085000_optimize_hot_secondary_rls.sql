-- TitanOS scalability hardening — high-activity secondary tables.
--
-- Preserve existing authorization semantics while evaluating request-constant
-- auth.uid()/is_admin() predicates once per statement via scalar SELECT init plans.
-- Also add only the missing leading indexes for FKs on these actively queried paths.

create index if not exists idx_activity_events_created_by_id
  on public.activity_events(created_by_id);
create index if not exists idx_customer_files_created_by_id
  on public.customer_files(created_by_id);
create index if not exists idx_driver_profiles_created_by_id
  on public.driver_profiles(created_by_id);
create index if not exists idx_employees_created_by_id
  on public.employees(created_by_id);
create index if not exists idx_job_photos_created_by_id
  on public.job_photos(created_by_id);
create index if not exists idx_marketplace_listings_created_by_id
  on public.marketplace_listings(created_by_id);
create index if not exists idx_marketplace_messages_created_by_id
  on public.marketplace_messages(created_by_id);
create index if not exists idx_notifications_created_by_id
  on public.notifications(created_by_id);

-- Activity feed.
alter policy activity_read on public.activity_events
  using (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
  );

alter policy activity_write on public.activity_events
  with check (created_by_id = (select auth.uid()));

-- Customer files.
alter policy customer_files_own on public.customer_files
  using (created_by_id = (select auth.uid()))
  with check (created_by_id = (select auth.uid()));

-- Driver profiles.
alter policy driver_profiles_select on public.driver_profiles
  using (
    published = true
    or user_id = (select auth.uid())
    or (select public.is_admin())
  );

alter policy driver_profiles_insert on public.driver_profiles
  with check (
    user_id = (select auth.uid())
    and created_by_id = (select auth.uid())
  );

alter policy driver_profiles_update on public.driver_profiles
  using (
    user_id = (select auth.uid())
    or (select public.is_admin())
  )
  with check (
    user_id = (select auth.uid())
    or (select public.is_admin())
  );

alter policy driver_profiles_delete on public.driver_profiles
  using (
    user_id = (select auth.uid())
    or (select public.is_admin())
  );

-- Driver trips.
alter policy driver_trips_own_select on public.driver_trips
  using (user_id = (select auth.uid()));

alter policy driver_trips_own_insert on public.driver_trips
  with check (user_id = (select auth.uid()));

alter policy driver_trips_own_update on public.driver_trips
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy driver_trips_own_delete on public.driver_trips
  using (user_id = (select auth.uid()));

-- Employees.
alter policy employees_select on public.employees
  using (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
  );

alter policy employees_insert on public.employees
  with check (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
  );

alter policy employees_update on public.employees
  using (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
  )
  with check (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
  );

alter policy employees_delete on public.employees
  using ((select public.is_admin()));

-- Expenses.
alter policy expenses_all on public.expenses
  using (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
  )
  with check (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
  );

-- Job photos. Admin may read/delete existing rows, but writes remain owner-bound.
alter policy job_photos_own on public.job_photos
  using (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
  )
  with check (created_by_id = (select auth.uid()));

-- Marketplace listings.
alter policy listings_select on public.marketplace_listings
  using (
    status = 'active'
    or created_by_id = (select auth.uid())
    or (select public.is_admin())
  );

alter policy listings_write on public.marketplace_listings
  using (
    created_by_id = (select auth.uid())
    or (select public.is_admin())
  )
  with check (
    (select public.is_admin())
    or (
      created_by_id = (select auth.uid())
      and seller_id = (select auth.uid())::text
    )
  );

-- Marketplace messages.
alter policy messages_select on public.marketplace_messages
  using (
    sender_id = (select auth.uid())::text
    or recipient_id = (select auth.uid())::text
    or created_by_id = (select auth.uid())
    or (select public.is_admin())
  );

alter policy messages_insert on public.marketplace_messages
  with check (
    sender_id = (select auth.uid())::text
    and created_by_id = (select auth.uid())
  );

alter policy messages_update on public.marketplace_messages
  using (
    sender_id = (select auth.uid())::text
    or recipient_id = (select auth.uid())::text
    or (select public.is_admin())
  )
  with check (
    (select public.is_admin())
    or sender_id = (select auth.uid())::text
    or recipient_id = (select auth.uid())::text
  );

alter policy messages_delete on public.marketplace_messages
  using (
    sender_id = (select auth.uid())::text
    or created_by_id = (select auth.uid())
    or (select public.is_admin())
  );

-- Notifications.
alter policy notifications_select on public.notifications
  using (
    user_id = (select auth.uid())::text
    or created_by_id = (select auth.uid())
    or (select public.is_admin())
  );

alter policy notifications_insert on public.notifications
  with check (
    user_id = (select auth.uid())::text
    and created_by_id = (select auth.uid())
  );

alter policy notifications_update on public.notifications
  using (
    user_id = (select auth.uid())::text
    or (select public.is_admin())
  )
  with check (
    user_id = (select auth.uid())::text
    or (select public.is_admin())
  );

alter policy notifications_delete on public.notifications
  using (
    user_id = (select auth.uid())::text
    or created_by_id = (select auth.uid())
    or (select public.is_admin())
  );
