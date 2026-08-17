-- Google Play UGC safety hardening: durable reports/blocks and reciprocal DM enforcement.

create table if not exists public.trust_reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'user' check (kind in ('user')),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reporter_name text,
  target_id uuid not null references auth.users(id) on delete cascade,
  target_name text,
  reason text not null,
  body text not null default '',
  link text not null default '',
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  constraint trust_reports_not_self check (reporter_id <> target_id)
);

create index if not exists trust_reports_status_created_idx
  on public.trust_reports(status, created_at desc);
create index if not exists trust_reports_reporter_idx
  on public.trust_reports(reporter_id, created_at desc);
create index if not exists trust_reports_target_idx
  on public.trust_reports(target_id, created_at desc);

alter table public.trust_reports enable row level security;

revoke all on public.trust_reports from anon;
revoke all on public.trust_reports from authenticated;
grant select, insert, update on public.trust_reports to authenticated;
grant all on public.trust_reports to service_role;

drop policy if exists trust_reports_insert_own on public.trust_reports;
create policy trust_reports_insert_own on public.trust_reports
  for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and reporter_id <> target_id
    and status = 'open'
    and resolved_at is null
    and resolved_by is null
  );

drop policy if exists trust_reports_select_own_or_admin on public.trust_reports;
create policy trust_reports_select_own_or_admin on public.trust_reports
  for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists trust_reports_update_admin on public.trust_reports;
create policy trust_reports_update_admin on public.trust_reports
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  blocked_name text,
  created_at timestamptz not null default now(),
  constraint user_blocks_not_self check (blocker_id <> blocked_id),
  constraint user_blocks_pair_unique unique (blocker_id, blocked_id)
);

create index if not exists user_blocks_blocker_idx
  on public.user_blocks(blocker_id, created_at desc);
create index if not exists user_blocks_blocked_idx
  on public.user_blocks(blocked_id, created_at desc);

alter table public.user_blocks enable row level security;

revoke all on public.user_blocks from anon;
revoke all on public.user_blocks from authenticated;
grant select, insert, update, delete on public.user_blocks to authenticated;
grant all on public.user_blocks to service_role;

drop policy if exists user_blocks_select_own on public.user_blocks;
create policy user_blocks_select_own on public.user_blocks
  for select to authenticated
  using (blocker_id = auth.uid());

drop policy if exists user_blocks_insert_own on public.user_blocks;
create policy user_blocks_insert_own on public.user_blocks
  for insert to authenticated
  with check (blocker_id = auth.uid() and blocker_id <> blocked_id);

drop policy if exists user_blocks_update_own on public.user_blocks;
create policy user_blocks_update_own on public.user_blocks
  for update to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid() and blocker_id <> blocked_id);

drop policy if exists user_blocks_delete_own on public.user_blocks;
create policy user_blocks_delete_own on public.user_blocks
  for delete to authenticated
  using (blocker_id = auth.uid());

-- Enforce reciprocal blocks below the UI. marketplace_messages stores IDs as text.
create or replace function public.enforce_marketplace_message_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sender_id is null or new.recipient_id is null then
    return new;
  end if;

  if exists (
    select 1
    from public.user_blocks b
    where
      (b.blocker_id::text = new.sender_id and b.blocked_id::text = new.recipient_id)
      or
      (b.blocker_id::text = new.recipient_id and b.blocked_id::text = new.sender_id)
  ) then
    raise exception 'Messaging is unavailable between these accounts.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_marketplace_message_block() from public;

drop trigger if exists trg_marketplace_messages_block on public.marketplace_messages;
create trigger trg_marketplace_messages_block
before insert on public.marketplace_messages
for each row execute function public.enforce_marketplace_message_block();
