begin;

alter table public.job_match_interactions
  add column if not exists job_title text,
  add column if not exists company_name text,
  add column if not exists job_city text,
  add column if not exists job_state text;

alter table public.job_match_interactions
  drop constraint if exists job_match_interactions_job_title_length,
  add constraint job_match_interactions_job_title_length
    check (job_title is null or char_length(job_title) <= 300),
  drop constraint if exists job_match_interactions_company_name_length,
  add constraint job_match_interactions_company_name_length
    check (company_name is null or char_length(company_name) <= 200),
  drop constraint if exists job_match_interactions_job_city_length,
  add constraint job_match_interactions_job_city_length
    check (job_city is null or char_length(job_city) <= 120),
  drop constraint if exists job_match_interactions_job_state_length,
  add constraint job_match_interactions_job_state_length
    check (job_state is null or char_length(job_state) <= 120);

comment on column public.job_match_interactions.job_title is 'Private seeker-side snapshot of the tracked opportunity title.';
comment on column public.job_match_interactions.company_name is 'Private seeker-side snapshot of the employer name supplied by the listing; never inferred from provider name.';
comment on column public.job_match_interactions.job_city is 'Private seeker-side snapshot of the tracked opportunity city.';
comment on column public.job_match_interactions.job_state is 'Private seeker-side snapshot of the tracked opportunity state or region.';

commit;
