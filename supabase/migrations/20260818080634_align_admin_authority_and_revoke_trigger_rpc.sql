-- RECOVERY PROVENANCE: restored verbatim from the authoritative applied
-- migration ledger of TitanOS Supabase project xcfjpxcmokdfwkarwomy.

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

revoke execute on function public.enforce_marketplace_message_block() from public;
revoke execute on function public.enforce_marketplace_message_block() from anon;
revoke execute on function public.enforce_marketplace_message_block() from authenticated;

comment on function public.is_admin() is
  'Server/database admin authority derived from immutable Supabase Auth app_metadata.role.';
