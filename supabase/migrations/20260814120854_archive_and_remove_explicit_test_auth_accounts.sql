create table if not exists public.legacy_test_account_purge_archive (
  id uuid primary key default gen_random_uuid(),
  archived_at timestamptz not null default now(),
  user_id uuid not null,
  email text,
  full_name text,
  profile_created_at timestamptz
);
alter table public.legacy_test_account_purge_archive enable row level security;

with doomed as (
  select p.id,p.email,p.full_name,p.created_at
  from public.profiles p
  where p.email ilike '%@titanos.test'
     or p.email in ('john.doe@example.com','jane.doe@example.com')
     or p.email ilike 'titanos-test-%@example.com'
     or p.email ilike 'titanostest-%@example.com'
)
insert into public.legacy_test_account_purge_archive(user_id,email,full_name,profile_created_at)
select id,email,full_name,created_at from doomed;

delete from auth.users u
where u.id in (
  select p.id from public.profiles p
  where p.email ilike '%@titanos.test'
     or p.email in ('john.doe@example.com','jane.doe@example.com')
     or p.email ilike 'titanos-test-%@example.com'
     or p.email ilike 'titanostest-%@example.com'
);
