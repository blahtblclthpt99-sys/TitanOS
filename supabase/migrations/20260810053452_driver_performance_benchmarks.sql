create table if not exists public.driver_performance_summaries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  score smallint not null check (score between 0 and 100),
  profit_per_hour numeric(10,2) not null default 0,
  profit_per_mile numeric(10,2) not null default 0,
  utilization smallint not null default 0 check (utilization between 0 and 100),
  trips integer not null default 0 check (trips >= 0),
  platform_count smallint not null default 0 check (platform_count between 0 and 32),
  period_days integer not null default 0 check (period_days >= 0),
  updated_at timestamptz not null default now()
);

alter table public.driver_performance_summaries enable row level security;

revoke all on table public.driver_performance_summaries from anon;
grant select, insert, update, delete on table public.driver_performance_summaries to authenticated;
grant all on table public.driver_performance_summaries to service_role;

drop policy if exists "drivers_read_own_performance" on public.driver_performance_summaries;
create policy "drivers_read_own_performance"
on public.driver_performance_summaries for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "drivers_insert_own_performance" on public.driver_performance_summaries;
create policy "drivers_insert_own_performance"
on public.driver_performance_summaries for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "drivers_update_own_performance" on public.driver_performance_summaries;
create policy "drivers_update_own_performance"
on public.driver_performance_summaries for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "drivers_delete_own_performance" on public.driver_performance_summaries;
create policy "drivers_delete_own_performance"
on public.driver_performance_summaries for delete
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists driver_performance_recent_cohort_idx
on public.driver_performance_summaries (updated_at desc)
where trips >= 5;

create or replace function public.get_driver_performance_benchmark()
returns table (
  cohort_size integer,
  score_percentile integer,
  hourly_percentile integer,
  mileage_percentile integer,
  cohort_median_score numeric,
  cohort_median_profit_per_hour numeric,
  cohort_median_profit_per_mile numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  with cohort as (
    select s.*
    from public.driver_performance_summaries s
    where s.updated_at >= now() - interval '90 days'
      and s.trips >= 5
  ), me as (
    select * from cohort where user_id = caller_id
  ), totals as (
    select count(*)::integer as n from cohort
  )
  select
    totals.n,
    case when totals.n >= 10 and exists (select 1 from me) then
      round(100.0 * (select count(*) from cohort c, me where c.score <= me.score) / totals.n)::integer
    end,
    case when totals.n >= 10 and exists (select 1 from me) then
      round(100.0 * (select count(*) from cohort c, me where c.profit_per_hour <= me.profit_per_hour) / totals.n)::integer
    end,
    case when totals.n >= 10 and exists (select 1 from me) then
      round(100.0 * (select count(*) from cohort c, me where c.profit_per_mile <= me.profit_per_mile) / totals.n)::integer
    end,
    case when totals.n >= 10 then (percentile_cont(0.5) within group (order by cohort.score))::numeric end,
    case when totals.n >= 10 then (percentile_cont(0.5) within group (order by cohort.profit_per_hour))::numeric end,
    case when totals.n >= 10 then (percentile_cont(0.5) within group (order by cohort.profit_per_mile))::numeric end
  from cohort cross join totals
  group by totals.n;
end;
$$;

revoke all on function public.get_driver_performance_benchmark() from public, anon;
grant execute on function public.get_driver_performance_benchmark() to authenticated, service_role;
