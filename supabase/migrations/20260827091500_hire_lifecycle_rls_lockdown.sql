-- Career-core native hire lifecycle RLS lockdown.
-- Preserve application history and make saved-job identity immutable.

begin;

-- Applications are lifecycle records. Applicants withdraw by changing status;
-- they may not erase the record. Only an admin may perform exceptional cleanup.
drop policy if exists hire_apps_delete on public.hire_applications;
drop policy if exists hire_apps_delete_admin on public.hire_applications;
create policy hire_apps_delete_admin on public.hire_applications
  for delete to authenticated
  using (public.is_admin());

-- The original FOR ALL saved-job policy also granted UPDATE authority. There is
-- no legitimate mutable identity on a save record, so split access by operation
-- and intentionally provide no UPDATE policy.
drop policy if exists hire_saves_own on public.hire_saves;
drop policy if exists hire_saves_select on public.hire_saves;
drop policy if exists hire_saves_insert on public.hire_saves;
drop policy if exists hire_saves_delete on public.hire_saves;

create policy hire_saves_select on public.hire_saves
  for select to authenticated
  using (
    created_by_id = auth.uid()
    and user_id = auth.uid()::text
  );

create policy hire_saves_insert on public.hire_saves
  for insert to authenticated
  with check (
    created_by_id = auth.uid()
    and user_id = auth.uid()::text
  );

create policy hire_saves_delete on public.hire_saves
  for delete to authenticated
  using (
    created_by_id = auth.uid()
    and user_id = auth.uid()::text
  );

comment on policy hire_apps_delete_admin on public.hire_applications is
  'Applications are retained as career lifecycle records; applicants withdraw by status and only admins may delete for exceptional cleanup.';
comment on policy hire_saves_insert on public.hire_saves is
  'Saved native jobs must be created by and for the authenticated user; saved-job rows are intentionally not updatable.';

commit;
