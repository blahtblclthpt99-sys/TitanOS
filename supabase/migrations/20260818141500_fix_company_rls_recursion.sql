-- Fix mutually recursive companies <-> company_members RLS evaluation.
-- Authorization semantics are preserved, but row-dependent cross-table checks
-- are executed through narrowly scoped, identity-bound SECURITY DEFINER helpers.

create or replace function public.is_company_owner(target_company_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_company_id is not null
    and (select auth.uid()) is not null
    and exists (
      select 1
      from public.companies c
      where c.id::text = target_company_id
        and (
          c.owner_id = (select auth.uid())::text
          or c.created_by_id = (select auth.uid())
        )
    );
$$;

create or replace function public.is_company_member(target_company_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_company_id is not null
    and (select auth.uid()) is not null
    and exists (
      select 1
      from public.company_members m
      where m.company_id = target_company_id
        and m.user_id = (select auth.uid())::text
        and m.status = 'active'
    );
$$;

revoke all on function public.is_company_owner(text) from public, anon;
revoke all on function public.is_company_member(text) from public, anon;
grant execute on function public.is_company_owner(text) to authenticated, service_role;
grant execute on function public.is_company_member(text) to authenticated, service_role;

comment on function public.is_company_owner(text) is
  'RLS helper: true only when the current authenticated user owns the target company.';
comment on function public.is_company_member(text) is
  'RLS helper: true only when the current authenticated user is an active member of the target company.';

drop policy if exists companies_member on public.companies;
create policy companies_member
  on public.companies
  for all
  to authenticated
  using (
    owner_id = (select auth.uid())::text
    or created_by_id = (select auth.uid())
    or (select public.is_admin())
    or public.is_company_member(id::text)
  )
  with check (
    owner_id = (select auth.uid())::text
    or created_by_id = (select auth.uid())
    or (select public.is_admin())
  );

drop policy if exists company_members_select on public.company_members;
create policy company_members_select
  on public.company_members
  for select
  to authenticated
  using (
    user_id = (select auth.uid())::text
    or created_by_id = (select auth.uid())
    or (select public.is_admin())
    or public.is_company_owner(company_id)
  );

drop policy if exists company_members_insert on public.company_members;
create policy company_members_insert
  on public.company_members
  for insert
  to authenticated
  with check (
    (select public.is_admin())
    or (
      created_by_id = (select auth.uid())
      and public.is_company_owner(company_id)
    )
  );

drop policy if exists company_members_update on public.company_members;
create policy company_members_update
  on public.company_members
  for update
  to authenticated
  using (
    (select public.is_admin())
    or public.is_company_owner(company_id)
  )
  with check (
    (select public.is_admin())
    or public.is_company_owner(company_id)
  );

drop policy if exists company_members_delete on public.company_members;
create policy company_members_delete
  on public.company_members
  for delete
  to authenticated
  using (
    (select public.is_admin())
    or user_id = (select auth.uid())::text
    or public.is_company_owner(company_id)
  );
