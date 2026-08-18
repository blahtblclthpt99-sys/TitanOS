-- Titan Support realtime foundation.
-- RLS remains authoritative for postgres_changes delivery.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_messages'
  ) then
    alter publication supabase_realtime add table public.support_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_cases'
  ) then
    alter publication supabase_realtime add table public.support_cases;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_case_events'
  ) then
    alter publication supabase_realtime add table public.support_case_events;
  end if;
end $$;
