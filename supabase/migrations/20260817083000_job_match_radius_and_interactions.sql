-- Job Match phase 2: precise radius inputs + owner-only interaction state.
-- Additive and backwards compatible with existing Hire saves/applications.

alter table public.hire_jobs
  add column if not exists lat double precision,
  add column if not exists lng double precision;

alter table public.hire_jobs
  drop constraint if exists hire_jobs_lat_range,
  add constraint hire_jobs_lat_range check (lat is null or (lat >= -90 and lat <= 90));

alter table public.hire_jobs
  drop constraint if exists hire_jobs_lng_range,
  add constraint hire_jobs_lng_range check (lng is null or (lng >= -180 and lng <= 180));

create index if not exists hire_jobs_location_idx
  on public.hire_jobs (state, city)
  where status = 'open';

create table if not exists public.job_match_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_by_id uuid not null,
  source text not null check (source in ('titan','external')),
  source_name text not null default 'TitanOS',
  source_job_id text not null,
  state text not null check (state in ('saved','ignored','applied')),
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, source_name, source_job_id)
);

alter table public.job_match_interactions enable row level security;

revoke all on public.job_match_interactions from anon;
grant select, insert, update, delete on public.job_match_interactions to authenticated;

-- Recreate policies idempotently.
drop policy if exists job_match_interactions_select_own on public.job_match_interactions;
create policy job_match_interactions_select_own
on public.job_match_interactions for select
to authenticated
using (user_id = auth.uid() and created_by_id = auth.uid());

drop policy if exists job_match_interactions_insert_own on public.job_match_interactions;
create policy job_match_interactions_insert_own
on public.job_match_interactions for insert
to authenticated
with check (user_id = auth.uid() and created_by_id = auth.uid());

drop policy if exists job_match_interactions_update_own on public.job_match_interactions;
create policy job_match_interactions_update_own
on public.job_match_interactions for update
to authenticated
using (user_id = auth.uid() and created_by_id = auth.uid())
with check (user_id = auth.uid() and created_by_id = auth.uid());

drop policy if exists job_match_interactions_delete_own on public.job_match_interactions;
create policy job_match_interactions_delete_own
on public.job_match_interactions for delete
to authenticated
using (user_id = auth.uid() and created_by_id = auth.uid());

create index if not exists job_match_interactions_user_state_idx
  on public.job_match_interactions (user_id, state, updated_at desc);

create index if not exists job_match_interactions_lookup_idx
  on public.job_match_interactions (user_id, source, source_name, source_job_id);
