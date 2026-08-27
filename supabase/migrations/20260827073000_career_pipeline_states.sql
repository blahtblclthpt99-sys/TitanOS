-- Career-core application pipeline lifecycle.
-- The original job_match_interactions table only allowed saved/ignored/applied.
-- TitanOS now supports an applicant-managed lifecycle through screening,
-- interview, offer, hired and closed. Existing values remain valid.

begin;

alter table public.job_match_interactions
  drop constraint if exists job_match_interactions_state_check;

alter table public.job_match_interactions
  add constraint job_match_interactions_state_check
  check (state in (
    'saved',
    'ignored',
    'applied',
    'screening',
    'interview',
    'offer',
    'hired',
    'closed'
  ));

comment on constraint job_match_interactions_state_check on public.job_match_interactions is
  'Applicant-managed career pipeline states. These states are organizational workflow only and are not employer ranking or automated employment decisions.';

commit;
