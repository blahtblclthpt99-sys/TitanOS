-- Career-core native application/save integrity.
-- Prevents duplicate writes under concurrency, validates native job availability,
-- and separates applicant authority from employer/admin hiring decisions.

begin;

create or replace function public.enforce_hire_application_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  job public.hire_jobs%rowtype;
  existing_count integer;
begin
  if tg_op = 'INSERT' then
    -- Serialize the same worker/job pair so concurrent clients cannot both apply.
    perform pg_advisory_xact_lock(hashtextextended('hire_application:' || new.worker_id || ':' || new.hire_job_id, 0));

    select * into job
    from public.hire_jobs
    where id::text = new.hire_job_id
    for share;

    if not found then
      raise exception 'Native job does not exist.' using errcode = '23514';
    end if;

    if job.status <> 'open' then
      raise exception 'This job is no longer accepting applications.' using errcode = '23514';
    end if;

    if job.deadline is not null and job.deadline < current_date then
      raise exception 'This job application deadline has passed.' using errcode = '23514';
    end if;

    if new.worker_id = job.customer_id or new.worker_id = job.created_by_id::text then
      raise exception 'Job owners cannot apply to their own job.' using errcode = '23514';
    end if;

    if actor is not null and not public.is_admin() then
      if new.worker_id <> actor::text or new.created_by_id is distinct from actor then
        raise exception 'Application identity must match the authenticated applicant.' using errcode = '42501';
      end if;
      if new.status <> 'pending' then
        raise exception 'Applicants cannot choose an employer decision status.' using errcode = '42501';
      end if;
    end if;

    select count(*) into existing_count
    from public.hire_applications
    where hire_job_id = new.hire_job_id
      and worker_id = new.worker_id;

    if existing_count > 0 then
      raise exception 'An application for this job already exists.' using errcode = '23505';
    end if;

    return new;
  end if;

  -- Immutable identity: updates may not move an application to another job/worker.
  if new.hire_job_id is distinct from old.hire_job_id
     or new.worker_id is distinct from old.worker_id
     or new.created_by_id is distinct from old.created_by_id then
    raise exception 'Application identity fields are immutable.' using errcode = '42501';
  end if;

  if actor is not null and not public.is_admin() then
    select * into job
    from public.hire_jobs
    where id::text = old.hire_job_id;

    if old.worker_id = actor::text then
      -- Applicant controls withdrawal only; accepted/rejected remain employer decisions.
      if new.status is distinct from old.status
         and not (old.status = 'pending' and new.status = 'withdrawn') then
        raise exception 'Applicants may only withdraw a pending application.' using errcode = '42501';
      end if;
    elsif found and (job.created_by_id = actor or job.customer_id = actor::text) then
      -- Employer decisions are limited to pending applications.
      if new.status is distinct from old.status
         and not (old.status = 'pending' and new.status in ('accepted', 'rejected')) then
        raise exception 'Employer application status transition is not allowed.' using errcode = '23514';
      end if;
    else
      raise exception 'Not authorized to update this application.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_hire_application_integrity() from public;
revoke all on function public.enforce_hire_application_integrity() from anon;
revoke all on function public.enforce_hire_application_integrity() from authenticated;

drop trigger if exists hire_application_integrity_guard on public.hire_applications;
create trigger hire_application_integrity_guard
before insert or update on public.hire_applications
for each row execute function public.enforce_hire_application_integrity();

create or replace function public.enforce_hire_save_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  existing_count integer;
begin
  -- A save must always reference a native TitanOS job. This prevents external
  -- provider identifiers from contaminating the native hire_saves table.
  if not exists (select 1 from public.hire_jobs where id::text = new.hire_job_id) then
    raise exception 'Native job does not exist.' using errcode = '23514';
  end if;

  if actor is not null and not public.is_admin() then
    if new.user_id <> actor::text or new.created_by_id is distinct from actor then
      raise exception 'Saved-job identity must match the authenticated user.' using errcode = '42501';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('hire_save:' || new.user_id || ':' || new.hire_job_id, 0));

  select count(*) into existing_count
  from public.hire_saves
  where user_id = new.user_id
    and hire_job_id = new.hire_job_id;

  if existing_count > 0 then
    raise exception 'This job is already saved.' using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_hire_save_integrity() from public;
revoke all on function public.enforce_hire_save_integrity() from anon;
revoke all on function public.enforce_hire_save_integrity() from authenticated;

drop trigger if exists hire_save_integrity_guard on public.hire_saves;
create trigger hire_save_integrity_guard
before insert on public.hire_saves
for each row execute function public.enforce_hire_save_integrity();

comment on function public.enforce_hire_application_integrity() is
  'Authoritative native application integrity: open/deadline checks, atomic duplicate prevention, immutable identity, and applicant/employer status authority.';
comment on function public.enforce_hire_save_integrity() is
  'Authoritative native saved-job integrity with native-job validation and concurrency-safe duplicate prevention.';

commit;
