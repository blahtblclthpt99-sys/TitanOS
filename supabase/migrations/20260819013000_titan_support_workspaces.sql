-- Titan Support workspace-awareness + support-domain hardening.
-- Additive/backwards compatible for existing cases. All DDL is transactional so
-- a prerequisite/schema-drift failure rolls the migration back as one unit.

begin;

alter table public.support_cases
  add column if not exists workspace text not null default 'general';

alter table public.support_cases
  drop constraint if exists support_cases_workspace_check;

alter table public.support_cases
  add constraint support_cases_workspace_check
  check (workspace in ('general','job_seeker','self_employed','business'));

-- Preserve all legacy categories while adding the focused TitanOS workspace surfaces.
alter table public.support_cases
  drop constraint if exists support_cases_category_check;

alter table public.support_cases
  add constraint support_cases_category_check
  check (category in (
    'account','billing','jobs','job_seeker','opportunities','applications','profile',
    'customers','scheduling','estimates','invoices','money','independent_work','business_os',
    'recruiting','employees','fleet','inventory','business_documents','titan_auto','leads',
    'driver_hub','gps','mileage','titan_ai','invisible_interface','android','pwa',
    'notifications','communications','files','import_export','technical','security','other'
  ));

create index if not exists support_cases_workspace_updated_idx
  on public.support_cases(workspace, updated_at desc);

comment on column public.support_cases.workspace is
  'TitanOS workspace active when the support case was created. Troubleshooting metadata only; never an entitlement or authorization grant.';

-- Support writes are server-API-owned. The browser keeps SELECT access for RLS-
-- protected Realtime delivery, but cannot forge priority/status/source/company/
-- workspace metadata through raw PostgREST requests.
drop policy if exists support_cases_customer_insert on public.support_cases;
drop policy if exists support_messages_customer_insert on public.support_messages;
drop policy if exists support_diagnostics_customer_insert on public.support_diagnostics;
drop policy if exists support_attachments_customer_insert on public.support_attachments;
drop policy if exists support_csat_customer_insert on public.support_csat;

revoke insert on public.support_cases, public.support_messages, public.support_diagnostics,
  public.support_attachments, public.support_csat from authenticated;

-- Storage uploads remain client-assisted, but the path must reference a Support
-- case actually owned by the signed-in user. Registration into support_attachments
-- still occurs through the hardened server API.
drop policy if exists support_storage_customer_insert on storage.objects;
create policy support_storage_customer_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.support_cases c
      where c.id::text = (storage.foldername(name))[2]
        and c.created_by_id = (select auth.uid())
    )
  );

-- One message insert owns all message-derived case state. The case row is locked
-- inside the message transaction so stale API reads cannot overwrite newer state.
create or replace function public.titan_support_sync_first_response()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_status text;
begin
  select c.status
  into current_status
  from public.support_cases c
  where c.id = new.case_id
  for update;

  if new.sender_kind in ('customer','support_ai')
    and current_status in ('RESOLVED','CLOSED') then
    raise exception 'support case does not accept customer/AI messages in % state', current_status
      using errcode = '23514';
  end if;

  if new.sender_kind in ('agent','engineering') and current_status = 'CLOSED' then
    raise exception 'closed support case does not accept staff replies'
      using errcode = '23514';
  end if;

  if new.sender_kind = 'system' and (new.metadata ->> 'event') = 'human_escalation_requested' then
    if current_status in ('RESOLVED','CLOSED') then
      raise exception 'resolved/closed support case must be reopened before escalation'
        using errcode = '23514';
    end if;
    if current_status in ('HUMAN_AGENT','ENGINEERING') then
      raise exception 'support case is already escalated'
        using errcode = '23505';
    end if;
  end if;

  if new.sender_kind = 'system' and (new.metadata ->> 'event') = 'case_reopened'
    and current_status not in ('RESOLVED','CLOSED') then
    raise exception 'only resolved/closed support cases can be reopened'
      using errcode = '23514';
  end if;

  update public.support_cases
  set
    first_response_at = case
      when new.sender_kind in ('support_ai','agent','engineering') then
        case
          when first_response_at is null then new.created_at
          else least(first_response_at, new.created_at)
        end
      else first_response_at
    end,
    last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at),
    updated_at = greatest(coalesce(updated_at, new.created_at), new.created_at),
    status = case
      when new.sender_kind = 'customer' and status = 'NEEDS_USER' then 'AI_WORKING'
      when new.sender_kind = 'support_ai' and status = 'NEW' then 'AI_WORKING'
      when new.sender_kind in ('agent','engineering')
        and (new.metadata ->> 'requested_status') in ('NEEDS_USER','HUMAN_AGENT','ENGINEERING','RESOLVED')
        then new.metadata ->> 'requested_status'
      when new.sender_kind = 'system'
        and (new.metadata ->> 'event') = 'human_escalation_requested'
        then 'HUMAN_AGENT'
      when new.sender_kind = 'system'
        and (new.metadata ->> 'event') = 'case_reopened'
        then 'NEW'
      else status
    end,
    escalated_at = case
      when (
        new.sender_kind in ('agent','engineering')
        and (new.metadata ->> 'requested_status') = 'ENGINEERING'
      ) or (
        new.sender_kind = 'system'
        and (new.metadata ->> 'event') = 'human_escalation_requested'
      ) then coalesce(escalated_at, new.created_at)
      else escalated_at
    end,
    resolved_at = case
      when new.sender_kind in ('agent','engineering')
        and (new.metadata ->> 'requested_status') = 'RESOLVED'
        then coalesce(resolved_at, new.created_at)
      when new.sender_kind = 'system'
        and (new.metadata ->> 'event') = 'case_reopened'
        then null
      else resolved_at
    end,
    closed_at = case
      when new.sender_kind = 'system'
        and (new.metadata ->> 'event') = 'case_reopened'
        then null
      else closed_at
    end
  where id = new.case_id;

  return new;
end;
$$;

revoke all on function public.titan_support_sync_first_response() from public, anon, authenticated;
grant execute on function public.titan_support_sync_first_response() to service_role;

drop trigger if exists support_messages_first_response on public.support_messages;
create trigger support_messages_first_response
  after insert on public.support_messages
  for each row
  execute function public.titan_support_sync_first_response();

commit;
