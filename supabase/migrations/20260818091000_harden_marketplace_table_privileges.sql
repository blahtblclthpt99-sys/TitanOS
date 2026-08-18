-- TitanOS Marketplace least-privilege hardening.
--
-- Public catalog reads remain available for marketplace_modules.
-- User-bound installs, waitlists and developer applications require an
-- authenticated Supabase session. Remove broad anon/authenticated table
-- privileges that are not needed by PostgREST CRUD and scope RLS roles to the
-- intended callers. Service role is unchanged and continues to bypass RLS.

create index if not exists idx_marketplace_modules_created_by_id
  on public.marketplace_modules(created_by_id);
create index if not exists idx_module_installs_created_by_id
  on public.module_installs(created_by_id);
create index if not exists idx_module_waitlists_created_by_id
  on public.module_waitlists(created_by_id);
create index if not exists idx_developer_applications_created_by_id
  on public.developer_applications(created_by_id);

-- Public catalog: anonymous/authenticated may read. Only authenticated admins
-- may mutate through the exposed schema.
drop policy if exists marketplace_modules_read on public.marketplace_modules;
create policy marketplace_modules_read
  on public.marketplace_modules
  for select
  to anon, authenticated
  using (true);

drop policy if exists marketplace_modules_admin on public.marketplace_modules;
create policy marketplace_modules_admin
  on public.marketplace_modules
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all privileges on table public.marketplace_modules from anon;
grant select on table public.marketplace_modules to anon;
revoke all privileges on table public.marketplace_modules from authenticated;
grant select, insert, update, delete on table public.marketplace_modules to authenticated;

-- Installs are strictly user/admin scoped and never anonymous.
drop policy if exists module_installs_all on public.module_installs;
create policy module_installs_all
  on public.module_installs
  for all
  to authenticated
  using (
    user_id = (select auth.uid())::text
    or (select public.is_admin())
  )
  with check (
    user_id = (select auth.uid())::text
    or (select public.is_admin())
  );

revoke all privileges on table public.module_installs from anon;
revoke all privileges on table public.module_installs from authenticated;
grant select, insert, update, delete on table public.module_installs to authenticated;

-- Waitlists are strictly user/admin scoped and never anonymous.
drop policy if exists module_waitlists_all on public.module_waitlists;
create policy module_waitlists_all
  on public.module_waitlists
  for all
  to authenticated
  using (
    user_id = (select auth.uid())::text
    or (select public.is_admin())
  )
  with check (
    user_id = (select auth.uid())::text
    or (select public.is_admin())
  );

revoke all privileges on table public.module_waitlists from anon;
revoke all privileges on table public.module_waitlists from authenticated;
grant select, insert, update, delete on table public.module_waitlists to authenticated;

-- Developer applications require a signed-in applicant. Admin review/update
-- remains authenticated and app_metadata-authorized.
drop policy if exists developer_applications_select on public.developer_applications;
create policy developer_applications_select
  on public.developer_applications
  for select
  to authenticated
  using (
    user_id = (select auth.uid())::text
    or (select public.is_admin())
  );

drop policy if exists developer_applications_insert on public.developer_applications;
create policy developer_applications_insert
  on public.developer_applications
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())::text
    or (select public.is_admin())
  );

drop policy if exists developer_applications_admin on public.developer_applications;
create policy developer_applications_admin
  on public.developer_applications
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all privileges on table public.developer_applications from anon;
revoke all privileges on table public.developer_applications from authenticated;
grant select, insert, update on table public.developer_applications to authenticated;
