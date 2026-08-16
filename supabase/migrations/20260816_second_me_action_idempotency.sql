create table if not exists public.titan_ai_action_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  action_id text not null,
  intent text not null,
  payload_hash text not null,
  status text not null check (status in ('processing', 'completed', 'failed')),
  result_json jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint titan_ai_action_ledger_user_action_unique unique (user_id, action_id)
);

create index if not exists titan_ai_action_ledger_user_created_idx
  on public.titan_ai_action_ledger (user_id, created_at desc);

alter table public.titan_ai_action_ledger enable row level security;

-- Intentionally no client policies. 2nd Me accesses this ledger only through
-- the server-side Supabase service role after authenticating the caller.
comment on table public.titan_ai_action_ledger is
  'Server-owned idempotency ledger for confirmed Titan AI/2nd Me write actions.';
