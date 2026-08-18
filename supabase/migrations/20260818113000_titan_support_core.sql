-- Titan Support — isolated customer support security domain.
-- Additive migration only. No existing TitanOS tables are dropped or rewritten.

create or replace function public.is_support_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = any (
      array['support_agent','senior_support','support_engineering','billing_support','support_admin','admin']::text[]
    ),
    false
  );
$$;

create or replace function public.is_support_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = any (
      array['support_admin','admin']::text[]
    ),
    false
  );
$$;

revoke all on function public.is_support_staff() from public, anon;
revoke all on function public.is_support_admin() from public, anon;
grant execute on function public.is_support_staff() to authenticated, service_role;
grant execute on function public.is_support_admin() to authenticated, service_role;

create table if not exists public.support_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique default ('T-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  created_by_id uuid not null,
  company_id text,
  title text not null check (char_length(title) between 3 and 180),
  description text not null check (char_length(description) between 3 and 10000),
  category text not null default 'technical' check (category in (
    'account','billing','jobs','customers','scheduling','estimates','invoices','money',
    'driver_hub','gps','mileage','titan_ai','invisible_interface','android','pwa',
    'notifications','communications','files','import_export','technical','security','other'
  )),
  status text not null default 'NEW' check (status in (
    'NEW','AI_WORKING','NEEDS_USER','HUMAN_AGENT','ENGINEERING','RESOLVED','CLOSED'
  )),
  priority text not null default 'P3' check (priority in ('P0','P1','P2','P3','P4')),
  source text not null default 'support_center' check (source in ('support_center','contextual_error','feedback','agent','system')),
  platform text,
  app_version text,
  last_message_at timestamptz not null default now(),
  first_response_at timestamptz,
  escalated_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases(id) on delete cascade,
  sender_user_id uuid,
  sender_kind text not null check (sender_kind in ('customer','support_ai','agent','engineering','system')),
  body text not null check (char_length(body) between 1 and 10000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.support_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases(id) on delete cascade,
  actor_user_id uuid,
  event_type text not null check (char_length(event_type) between 2 and 80),
  from_status text,
  to_status text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.support_diagnostics (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases(id) on delete cascade,
  created_by_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  redaction_version integer not null default 1 check (redaction_version > 0),
  consented_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.support_agent_assignments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases(id) on delete cascade,
  agent_user_id uuid not null,
  assignment_role text not null default 'support_agent' check (assignment_role in (
    'support_agent','senior_support','support_engineering','billing_support'
  )),
  assigned_by_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create unique index if not exists support_agent_assignments_one_active
  on public.support_agent_assignments(case_id, agent_user_id)
  where active;

create table if not exists public.support_attachments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases(id) on delete cascade,
  created_by_id uuid not null,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (mime_type in (
    'image/jpeg','image/png','image/webp','application/pdf','text/plain','text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','video/mp4'
  )),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now()
);

create table if not exists public.support_incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 180),
  status text not null default 'INVESTIGATING' check (status in ('INVESTIGATING','IDENTIFIED','MONITORING','RESOLVED')),
  severity text not null default 'P2' check (severity in ('P0','P1','P2','P3')),
  public_summary text,
  internal_summary text,
  created_by_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.support_incident_cases (
  incident_id uuid not null references public.support_incidents(id) on delete cascade,
  case_id uuid not null references public.support_cases(id) on delete cascade,
  linked_by_id uuid,
  created_at timestamptz not null default now(),
  primary key (incident_id, case_id)
);

create table if not exists public.support_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null check (char_length(title) between 3 and 180),
  category text not null,
  audience text not null default 'customer' check (audience in ('customer','staff','engineering')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  current_version integer not null default 1 check (current_version > 0),
  product_version text,
  last_reviewed_at timestamptz,
  created_by_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_article_versions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.support_articles(id) on delete cascade,
  version integer not null check (version > 0),
  content text not null check (char_length(content) between 10 and 50000),
  change_summary text,
  created_by_id uuid,
  created_at timestamptz not null default now(),
  unique(article_id, version)
);

create table if not exists public.support_csat (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.support_cases(id) on delete cascade,
  created_by_id uuid not null,
  solved boolean not null,
  rating smallint check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.support_audit_logs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.support_cases(id) on delete set null,
  actor_user_id uuid,
  action text not null check (char_length(action) between 2 and 120),
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists support_cases_owner_updated_idx on public.support_cases(created_by_id, updated_at desc);
create index if not exists support_cases_status_priority_idx on public.support_cases(status, priority, updated_at desc);
create index if not exists support_cases_company_idx on public.support_cases(company_id) where company_id is not null;
create index if not exists support_messages_case_created_idx on public.support_messages(case_id, created_at);
create index if not exists support_events_case_created_idx on public.support_case_events(case_id, created_at);
create index if not exists support_diagnostics_case_created_idx on public.support_diagnostics(case_id, created_at desc);
create index if not exists support_assignments_agent_active_idx on public.support_agent_assignments(agent_user_id, active, created_at desc);
create index if not exists support_attachments_case_idx on public.support_attachments(case_id, created_at);
create index if not exists support_incidents_status_idx on public.support_incidents(status, severity, updated_at desc);
create index if not exists support_incident_cases_case_idx on public.support_incident_cases(case_id);
create index if not exists support_articles_status_audience_idx on public.support_articles(status, audience, category);
create index if not exists support_audit_case_created_idx on public.support_audit_logs(case_id, created_at desc);

alter table public.support_cases enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_case_events enable row level security;
alter table public.support_diagnostics enable row level security;
alter table public.support_agent_assignments enable row level security;
alter table public.support_attachments enable row level security;
alter table public.support_incidents enable row level security;
alter table public.support_incident_cases enable row level security;
alter table public.support_articles enable row level security;
alter table public.support_article_versions enable row level security;
alter table public.support_csat enable row level security;
alter table public.support_audit_logs enable row level security;

-- Customers own only their own cases. Privileged state changes are server-side only.
create policy support_cases_customer_select on public.support_cases
  for select to authenticated
  using ((select auth.uid()) = created_by_id);
create policy support_cases_customer_insert on public.support_cases
  for insert to authenticated
  with check ((select auth.uid()) = created_by_id and status = 'NEW');
create policy support_cases_staff_select on public.support_cases
  for select to authenticated
  using (
    public.is_support_admin()
    or exists (
      select 1 from public.support_agent_assignments a
      where a.case_id = support_cases.id
        and a.agent_user_id = (select auth.uid())
        and a.active
    )
  );

create policy support_messages_customer_select on public.support_messages
  for select to authenticated
  using (exists (
    select 1 from public.support_cases c
    where c.id = support_messages.case_id and c.created_by_id = (select auth.uid())
  ));
create policy support_messages_customer_insert on public.support_messages
  for insert to authenticated
  with check (
    sender_kind = 'customer'
    and sender_user_id = (select auth.uid())
    and exists (
      select 1 from public.support_cases c
      where c.id = support_messages.case_id and c.created_by_id = (select auth.uid())
    )
  );
create policy support_messages_staff_select on public.support_messages
  for select to authenticated
  using (
    public.is_support_admin()
    or exists (
      select 1 from public.support_agent_assignments a
      where a.case_id = support_messages.case_id
        and a.agent_user_id = (select auth.uid())
        and a.active
    )
  );

create policy support_events_customer_select on public.support_case_events
  for select to authenticated
  using (exists (
    select 1 from public.support_cases c
    where c.id = support_case_events.case_id and c.created_by_id = (select auth.uid())
  ));
create policy support_events_staff_select on public.support_case_events
  for select to authenticated
  using (
    public.is_support_admin()
    or exists (
      select 1 from public.support_agent_assignments a
      where a.case_id = support_case_events.case_id
        and a.agent_user_id = (select auth.uid())
        and a.active
    )
  );

create policy support_diagnostics_customer_select on public.support_diagnostics
  for select to authenticated
  using (created_by_id = (select auth.uid()));
create policy support_diagnostics_customer_insert on public.support_diagnostics
  for insert to authenticated
  with check (
    created_by_id = (select auth.uid())
    and exists (
      select 1 from public.support_cases c
      where c.id = support_diagnostics.case_id and c.created_by_id = (select auth.uid())
    )
  );
create policy support_diagnostics_staff_select on public.support_diagnostics
  for select to authenticated
  using (
    public.is_support_admin()
    or exists (
      select 1 from public.support_agent_assignments a
      where a.case_id = support_diagnostics.case_id
        and a.agent_user_id = (select auth.uid())
        and a.active
    )
  );

create policy support_assignments_agent_select on public.support_agent_assignments
  for select to authenticated
  using (agent_user_id = (select auth.uid()) or public.is_support_admin());

create policy support_attachments_customer_select on public.support_attachments
  for select to authenticated
  using (created_by_id = (select auth.uid()));
create policy support_attachments_customer_insert on public.support_attachments
  for insert to authenticated
  with check (
    created_by_id = (select auth.uid())
    and exists (
      select 1 from public.support_cases c
      where c.id = support_attachments.case_id and c.created_by_id = (select auth.uid())
    )
  );
create policy support_attachments_staff_select on public.support_attachments
  for select to authenticated
  using (
    public.is_support_admin()
    or exists (
      select 1 from public.support_agent_assignments a
      where a.case_id = support_attachments.case_id
        and a.agent_user_id = (select auth.uid())
        and a.active
    )
  );

create policy support_incidents_customer_select on public.support_incidents
  for select to authenticated
  using (exists (
    select 1
    from public.support_incident_cases ic
    join public.support_cases c on c.id = ic.case_id
    where ic.incident_id = support_incidents.id and c.created_by_id = (select auth.uid())
  ));
create policy support_incidents_staff_select on public.support_incidents
  for select to authenticated
  using (public.is_support_staff());

create policy support_incident_cases_customer_select on public.support_incident_cases
  for select to authenticated
  using (exists (
    select 1 from public.support_cases c
    where c.id = support_incident_cases.case_id and c.created_by_id = (select auth.uid())
  ));
create policy support_incident_cases_staff_select on public.support_incident_cases
  for select to authenticated
  using (public.is_support_staff());

create policy support_articles_customer_select on public.support_articles
  for select to authenticated
  using (status = 'published' and audience = 'customer');
create policy support_articles_staff_select on public.support_articles
  for select to authenticated
  using (public.is_support_staff());
create policy support_article_versions_customer_select on public.support_article_versions
  for select to authenticated
  using (exists (
    select 1 from public.support_articles a
    where a.id = support_article_versions.article_id
      and a.status = 'published'
      and a.audience = 'customer'
      and a.current_version = support_article_versions.version
  ));
create policy support_article_versions_staff_select on public.support_article_versions
  for select to authenticated
  using (public.is_support_staff());

create policy support_csat_customer_select on public.support_csat
  for select to authenticated
  using (created_by_id = (select auth.uid()));
create policy support_csat_customer_insert on public.support_csat
  for insert to authenticated
  with check (
    created_by_id = (select auth.uid())
    and exists (
      select 1 from public.support_cases c
      where c.id = support_csat.case_id
        and c.created_by_id = (select auth.uid())
        and c.status in ('RESOLVED','CLOSED')
    )
  );
create policy support_csat_staff_select on public.support_csat
  for select to authenticated
  using (
    public.is_support_admin()
    or exists (
      select 1 from public.support_agent_assignments a
      where a.case_id = support_csat.case_id
        and a.agent_user_id = (select auth.uid())
        and a.active
    )
  );

create policy support_audit_admin_select on public.support_audit_logs
  for select to authenticated
  using (public.is_support_admin());

-- Explicit privileges: customer-safe reads/inserts only. Staff/admin mutations flow through hardened server APIs.
revoke all on public.support_cases, public.support_messages, public.support_case_events,
  public.support_diagnostics, public.support_agent_assignments, public.support_attachments,
  public.support_incidents, public.support_incident_cases, public.support_articles,
  public.support_article_versions, public.support_csat, public.support_audit_logs from anon;

revoke update, delete, truncate, references, trigger on public.support_cases, public.support_messages,
  public.support_case_events, public.support_diagnostics, public.support_agent_assignments,
  public.support_attachments, public.support_incidents, public.support_incident_cases,
  public.support_articles, public.support_article_versions, public.support_csat,
  public.support_audit_logs from authenticated;

grant select, insert on public.support_cases, public.support_messages, public.support_diagnostics,
  public.support_attachments, public.support_csat to authenticated;
grant select on public.support_case_events, public.support_agent_assignments,
  public.support_incidents, public.support_incident_cases, public.support_articles,
  public.support_article_versions, public.support_audit_logs to authenticated;

-- Dedicated private bucket with bucket-enforced MIME/size limits.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  10485760,
  array[
    'image/jpeg','image/png','image/webp','application/pdf','text/plain','text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','video/mp4'
  ]::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy support_storage_customer_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy support_storage_customer_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'support-attachments'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_support_admin()
      or exists (
        select 1
        from public.support_attachments sa
        join public.support_agent_assignments aa on aa.case_id = sa.case_id
        where sa.storage_path = storage.objects.name
          and aa.agent_user_id = (select auth.uid())
          and aa.active
      )
    )
  );
create policy support_storage_customer_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Seed versioned customer-facing support knowledge without coupling it to Titan AI knowledge.
insert into public.support_articles (slug, title, category, audience, status, current_version, product_version, last_reviewed_at)
values
  ('support-getting-started', 'Using Titan Support', 'technical', 'customer', 'published', 1, '2.x', now()),
  ('support-gps-troubleshooting', 'GPS and mileage troubleshooting', 'gps', 'customer', 'published', 1, '2.x', now()),
  ('support-invoice-delivery', 'Invoice delivery troubleshooting', 'invoices', 'customer', 'published', 1, '2.x', now()),
  ('support-subscription-status', 'Subscription and entitlement troubleshooting', 'billing', 'customer', 'published', 1, '2.x', now())
on conflict (slug) do nothing;

insert into public.support_article_versions (article_id, version, content, change_summary)
select id, 1,
  case slug
    when 'support-getting-started' then 'Titan Support is the dedicated troubleshooting system for TitanOS. Describe the problem, include a screenshot when useful, and explicitly consent before diagnostic context is attached. Titan Support AI is separate from Titan AI and cannot bypass normal account permissions.'
    when 'support-gps-troubleshooting' then 'If Driver Hub is not recording location or mileage, verify device location permission, TitanOS location permission, network state, and whether tracking is actively started. TitanOS should not track location outside user-authorized product behavior. If the issue persists, create a support case with diagnostic consent so route, platform, app version, permission/error code, and correlation identifiers can be reviewed without sending secrets.'
    when 'support-invoice-delivery' then 'If an invoice does not send, first confirm the invoice still exists and review its customer relationship and delivery status. A missing or archived customer must not make the invoice irrecoverable. Titan Support can inspect sanitized delivery/error references but must not expose server secrets or unrelated customer records.'
    when 'support-subscription-status' then 'If subscription state looks wrong, compare the visible plan/status with the server entitlement state. Titan Support may offer a bounded Refresh Subscription Status operation when available. AI must never issue a refund or change a subscription without explicit confirmation and an authorized server operation.'
  end,
  'Initial Titan Support knowledge base'
from public.support_articles
where slug in ('support-getting-started','support-gps-troubleshooting','support-invoice-delivery','support-subscription-status')
on conflict (article_id, version) do nothing;
