create table if not exists public.legacy_demo_purge_archive (
  id uuid primary key default gen_random_uuid(),
  archived_at timestamptz not null default now(),
  source_file text not null,
  target_table text not null,
  target_id text not null,
  source_id text,
  payload jsonb
);
alter table public.legacy_demo_purge_archive enable row level security;

insert into public.legacy_demo_purge_archive(source_file,target_table,target_id,source_id,payload)
select source_file,target_table,target_id,source_id,payload
from public.legacy_import_id_map
where source_file in ('Customer_export.csv','Job_export.csv','Invoice_export.csv','Expense_export.csv','Vehicle_export.csv');

delete from public.jobs j
using public.legacy_import_id_map m
where m.source_file='Job_export.csv' and m.target_table='jobs' and j.id::text=m.target_id;

delete from public.invoices i
using public.legacy_import_id_map m
where m.source_file='Invoice_export.csv' and m.target_table='invoices' and i.id::text=m.target_id;

delete from public.expenses e
using public.legacy_import_id_map m
where m.source_file='Expense_export.csv' and m.target_table='expenses' and e.id::text=m.target_id;

delete from public.equipment e
using public.legacy_import_id_map m
where m.source_file='Vehicle_export.csv' and m.target_table='equipment' and e.id::text=m.target_id;

delete from public.customers c
using public.legacy_import_id_map m
where m.source_file='Customer_export.csv' and m.target_table='customers' and c.id::text=m.target_id;

delete from public.legacy_import_id_map
where source_file in ('Customer_export.csv','Job_export.csv','Invoice_export.csv','Expense_export.csv','Vehicle_export.csv');
