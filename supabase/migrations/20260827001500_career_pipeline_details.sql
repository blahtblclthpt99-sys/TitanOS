begin;

alter table public.job_match_interactions
  add column if not exists interview_at timestamptz,
  add column if not exists follow_up_at timestamptz,
  add column if not exists private_notes text;

comment on column public.job_match_interactions.interview_at is 'Private applicant-managed interview date/time.';
comment on column public.job_match_interactions.follow_up_at is 'Private applicant-managed follow-up reminder date/time.';
comment on column public.job_match_interactions.private_notes is 'Private applicant notes; never used for employer ranking or automated employment decisions.';

commit;
