-- TitanOS production hardening: keep database/RLS admin authority aligned with
-- the server-side invariant. Auth app_metadata is controlled by the auth admin
-- boundary and is not writable through the public profiles table.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- This is a trigger function and is never intended to be invoked through
-- PostgREST RPC. The trigger itself continues to execute normally.
revoke execute on function public.enforce_marketplace_message_block() from public;
revoke execute on function public.enforce_marketplace_message_block() from anon;
revoke execute on function public.enforce_marketplace_message_block() from authenticated;

comment on function public.is_admin() is
  'Server/database admin authority derived from immutable Supabase Auth app_metadata.role.';
