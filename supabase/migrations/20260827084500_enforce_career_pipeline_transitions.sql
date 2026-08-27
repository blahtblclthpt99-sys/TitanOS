-- Enforce applicant-managed career pipeline transitions at the database boundary.
-- This closes client/API race windows and prevents direct updates from silently
-- regressing application history. The state is organizational workflow only.

begin;

create or replace function public.enforce_career_pipeline_transition()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  old_rank integer;
  new_rank integer;
begin
  if new.state = old.state then
    return new;
  end if;

  -- Ignored is a search preference, not a normal application destination.
  -- A saved opportunity may be ignored; an ignored opportunity may only be
  -- explicitly restored to saved or applied.
  if old.state = 'ignored' then
    if new.state in ('saved', 'applied') then
      return new;
    end if;
    raise exception 'invalid career pipeline transition from % to %', old.state, new.state
      using errcode = '23514';
  end if;

  if new.state = 'ignored' then
    if old.state = 'saved' then
      return new;
    end if;
    raise exception 'invalid career pipeline transition from % to %', old.state, new.state
      using errcode = '23514';
  end if;

  old_rank := array_position(array['saved','applied','screening','interview','offer','hired','closed']::text[], old.state);
  new_rank := array_position(array['saved','applied','screening','interview','offer','hired','closed']::text[], new.state);

  if old_rank is null or new_rank is null or new_rank <= old_rank then
    raise exception 'invalid career pipeline transition from % to %', old.state, new.state
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.enforce_career_pipeline_transition() is
  'Database-level monotonic transition guard for applicant-managed career pipeline state. Not used for employer ranking or automated employment decisions.';

revoke all on function public.enforce_career_pipeline_transition() from public;
revoke all on function public.enforce_career_pipeline_transition() from anon;
revoke all on function public.enforce_career_pipeline_transition() from authenticated;

drop trigger if exists enforce_career_pipeline_transition on public.job_match_interactions;
create trigger enforce_career_pipeline_transition
before update of state on public.job_match_interactions
for each row
execute function public.enforce_career_pipeline_transition();

commit;
