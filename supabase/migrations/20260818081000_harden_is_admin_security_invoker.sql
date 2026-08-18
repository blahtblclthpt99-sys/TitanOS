-- TitanOS production hardening: is_admin() only inspects the caller's Auth JWT,
-- so it does not require SECURITY DEFINER. Keep it callable by authenticated
-- users because RLS policies depend on it, while preventing anonymous RPC use.

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

revoke execute on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to service_role;

comment on function public.is_admin() is
  'RLS admin predicate derived from Supabase Auth app_metadata.role; runs with caller privileges.';
