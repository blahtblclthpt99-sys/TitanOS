create table if not exists public.server_runtime_secrets (
  key text primary key,
  secret_value text not null,
  updated_at timestamptz not null default now()
);
alter table public.server_runtime_secrets enable row level security;
revoke all on table public.server_runtime_secrets from anon, authenticated;
grant select, insert, update, delete on table public.server_runtime_secrets to service_role;
comment on table public.server_runtime_secrets is 'Server-only runtime secrets. RLS enabled; no client policies; service_role only.';
