create table if not exists public.titan_rate_limit_buckets (
  bucket_key text primary key,
  request_count integer not null check (request_count >= 0),
  window_started_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.titan_rate_limit_buckets enable row level security;

revoke all on public.titan_rate_limit_buckets from anon, authenticated, public;
grant select, insert, update, delete on public.titan_rate_limit_buckets to service_role;

create or replace function public.consume_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.titan_rate_limit_buckets%rowtype;
  v_window_seconds integer := greatest(1, least(coalesce(p_window_seconds, 60), 86400));
  v_limit integer := greatest(1, least(coalesce(p_limit, 60), 100000));
begin
  if p_bucket_key is null or length(p_bucket_key) < 1 or length(p_bucket_key) > 512 then
    raise exception 'invalid rate-limit bucket';
  end if;

  insert into public.titan_rate_limit_buckets(bucket_key, request_count, window_started_at, updated_at)
  values (p_bucket_key, 0, v_now, v_now)
  on conflict (bucket_key) do nothing;

  select * into v_row
  from public.titan_rate_limit_buckets
  where bucket_key = p_bucket_key
  for update;

  if v_row.window_started_at + make_interval(secs => v_window_seconds) <= v_now then
    update public.titan_rate_limit_buckets
       set request_count = 1,
           window_started_at = v_now,
           updated_at = v_now
     where bucket_key = p_bucket_key;
    return query select true, 0;
    return;
  end if;

  if v_row.request_count >= v_limit then
    return query select false,
      greatest(1, ceil(extract(epoch from ((v_row.window_started_at + make_interval(secs => v_window_seconds)) - v_now)))::integer);
    return;
  end if;

  update public.titan_rate_limit_buckets
     set request_count = request_count + 1,
         updated_at = v_now
   where bucket_key = p_bucket_key;

  return query select true, 0;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

comment on function public.consume_rate_limit(text, integer, integer) is
  'Server-only durable fixed-window rate limiter used by sensitive TitanOS API routes.';
