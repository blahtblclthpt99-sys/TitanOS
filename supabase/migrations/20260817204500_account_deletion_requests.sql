create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email_snapshot text,
  status text not null default 'pending' check (status in ('pending','processing','completed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_deletion_requests enable row level security;

revoke all on table public.account_deletion_requests from anon, authenticated;
grant all on table public.account_deletion_requests to service_role;

create index if not exists account_deletion_requests_status_requested_idx
  on public.account_deletion_requests(status, requested_at);

comment on table public.account_deletion_requests is
  'Server-owned queue of authenticated TitanOS account deletion requests. Client roles have no direct access.';
