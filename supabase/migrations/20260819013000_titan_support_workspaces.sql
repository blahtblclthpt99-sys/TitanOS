-- Titan Support workspace-awareness.
-- Additive and backwards compatible: existing cases remain in the general workspace.

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
