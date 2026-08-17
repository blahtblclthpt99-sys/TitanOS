begin;

create table if not exists public.job_match_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_by_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  job_interests text[] not null default '{}',
  work_radius_miles integer not null default 50,
  desired_pay_min numeric not null default 0,
  desired_pay_type text not null default 'hourly',
  preferred_schedule text[] not null default '{}',
  external_job_search_consent boolean not null default false,
  external_job_search_consent_at timestamptz,
  constraint job_match_preferences_owner_check check (user_id = created_by_id),
  constraint job_match_preferences_radius_check check (work_radius_miles between 1 and 500),
  constraint job_match_preferences_pay_check check (desired_pay_min >= 0),
  constraint job_match_preferences_pay_type_check check (desired_pay_type in ('hourly','salary','flat','any'))
);

alter table public.job_match_preferences enable row level security;

revoke all on public.job_match_preferences from anon;
revoke all on public.job_match_preferences from authenticated;
grant select, insert, update, delete on public.job_match_preferences to authenticated;
grant all on public.job_match_preferences to service_role;

create policy job_match_preferences_select_own on public.job_match_preferences
  for select to authenticated
  using (user_id = auth.uid() and created_by_id = auth.uid());

create policy job_match_preferences_insert_own on public.job_match_preferences
  for insert to authenticated
  with check (user_id = auth.uid() and created_by_id = auth.uid());

create policy job_match_preferences_update_own on public.job_match_preferences
  for update to authenticated
  using (user_id = auth.uid() and created_by_id = auth.uid())
  with check (user_id = auth.uid() and created_by_id = auth.uid());

create policy job_match_preferences_delete_own on public.job_match_preferences
  for delete to authenticated
  using (user_id = auth.uid() and created_by_id = auth.uid());

create index if not exists job_match_preferences_interests_idx
  on public.job_match_preferences using gin (job_interests, preferred_schedule);

comment on table public.job_match_preferences is
  'Private owner-only worker preferences used by TitanOS job matching. Never publish through the driver directory.';
comment on column public.job_match_preferences.external_job_search_consent is
  'Explicit consent to query approved external job providers. Never authorizes applying to a job.';

-- The prior additive migration briefly placed these fields on driver_profiles.
-- No production user has set a non-default value before this corrective migration.
drop index if exists public.driver_profiles_job_match_idx;

alter table public.driver_profiles
  drop column if exists job_interests,
  drop column if exists work_radius_miles,
  drop column if exists desired_pay_min,
  drop column if exists desired_pay_type,
  drop column if exists preferred_schedule,
  drop column if exists external_job_search_consent,
  drop column if exists external_job_search_consent_at;

create index if not exists driver_profiles_skill_match_idx
  on public.driver_profiles using gin (skills, certifications);

commit;
