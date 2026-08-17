begin;

alter table public.driver_profiles
  add column if not exists job_interests text[] not null default '{}',
  add column if not exists work_radius_miles integer not null default 50,
  add column if not exists desired_pay_min numeric not null default 0,
  add column if not exists desired_pay_type text not null default 'hourly',
  add column if not exists preferred_schedule text[] not null default '{}',
  add column if not exists external_job_search_consent boolean not null default false,
  add column if not exists external_job_search_consent_at timestamptz;

alter table public.driver_profiles
  drop constraint if exists driver_profiles_work_radius_miles_check,
  add constraint driver_profiles_work_radius_miles_check
    check (work_radius_miles between 1 and 500),
  drop constraint if exists driver_profiles_desired_pay_min_check,
  add constraint driver_profiles_desired_pay_min_check
    check (desired_pay_min >= 0),
  drop constraint if exists driver_profiles_desired_pay_type_check,
  add constraint driver_profiles_desired_pay_type_check
    check (desired_pay_type in ('hourly','salary','flat','any'));

alter table public.hire_jobs
  add column if not exists required_skills text[] not null default '{}',
  add column if not exists required_certifications text[] not null default '{}',
  add column if not exists minimum_years_experience integer not null default 0,
  add column if not exists employment_type text not null default 'gig',
  add column if not exists pay_type text not null default 'flat',
  add column if not exists schedule_tags text[] not null default '{}',
  add column if not exists work_mode text not null default 'onsite';

alter table public.hire_jobs
  drop constraint if exists hire_jobs_minimum_years_experience_check,
  add constraint hire_jobs_minimum_years_experience_check
    check (minimum_years_experience between 0 and 80),
  drop constraint if exists hire_jobs_employment_type_check,
  add constraint hire_jobs_employment_type_check
    check (employment_type in ('gig','part_time','full_time','contract','temporary')),
  drop constraint if exists hire_jobs_pay_type_check,
  add constraint hire_jobs_pay_type_check
    check (pay_type in ('hourly','salary','flat','per_mile','per_stop')),
  drop constraint if exists hire_jobs_work_mode_check,
  add constraint hire_jobs_work_mode_check
    check (work_mode in ('onsite','hybrid','remote'));

create index if not exists driver_profiles_job_match_idx
  on public.driver_profiles using gin (skills, certifications, job_interests, preferred_schedule);

create index if not exists hire_jobs_match_requirements_idx
  on public.hire_jobs using gin (required_skills, required_certifications, schedule_tags);

comment on column public.driver_profiles.external_job_search_consent is
  'Explicit user consent for TitanOS to query approved external job providers. Does not authorize applications.';
comment on column public.driver_profiles.external_job_search_consent_at is
  'Timestamp of most recent affirmative external job search consent.';
comment on column public.hire_jobs.required_skills is
  'Normalized skills used by TitanOS job matching; native job remains authoritative source.';

commit;
