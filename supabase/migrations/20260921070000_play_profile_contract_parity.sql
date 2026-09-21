-- TitanOS Play recovery schema parity.
-- Restores profile fields read by the Android app without reintroducing
-- the older pre-verification founding auto-claim trigger.

alter table public.profiles
  add column if not exists marketing_prefs jsonb not null default '{}'::jsonb,
  add column if not exists professional_profile jsonb not null default '{}'::jsonb,
  add column if not exists founding_user boolean not null default false,
  add column if not exists founding_number integer,
  add column if not exists founding_trial_ends_at timestamptz,
  add column if not exists founding_price_lock numeric(10,2),
  add column if not exists founding_locked_plan text,
  add column if not exists marketplace_pack_unlocked boolean not null default false;

create unique index if not exists profiles_founding_number_uidx
  on public.profiles(founding_number)
  where founding_number is not null;

create index if not exists profiles_founding_user_idx
  on public.profiles(founding_user)
  where founding_user = true;

create table if not exists public.platform_launch (
  id integer primary key default 1 check (id = 1),
  founding_cap integer not null default 100,
  founding_claimed integer not null default 0,
  beta_active boolean not null default true,
  beta_closed_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.platform_launch (id, founding_cap, founding_claimed, beta_active)
values (1,100,0,true)
on conflict (id) do nothing;

alter table public.platform_launch enable row level security;

drop policy if exists platform_launch_public_read on public.platform_launch;
create policy platform_launch_public_read
on public.platform_launch
for select
to anon, authenticated
using (true);

comment on column public.profiles.marketing_prefs is
  'Email/SMS/push marketing channels, frequency, and categories';
comment on column public.profiles.professional_profile is
  'Public professional profile payload';
comment on column public.profiles.founding_user is
  'Founding 100 member; claim occurs only after verified auth';
comment on column public.profiles.founding_trial_ends_at is
  'End of free founding trial';
comment on column public.profiles.founding_price_lock is
  'Lifetime locked monthly founding price';
comment on column public.profiles.founding_locked_plan is
  'Founding plan id';
comment on column public.profiles.marketplace_pack_unlocked is
  'Server-owned marketplace pack entitlement';

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and coalesce(auth.role(), '') <> 'service_role'
     and not public.is_admin() then
    new.role := old.role;
    new.is_pro := old.is_pro;
    new.lifetime_premium := old.lifetime_premium;
    if old.paying_subscriber is not null then
      new.paying_subscriber := old.paying_subscriber;
    end if;
    new.plan_tier := old.plan_tier;
    new.verified_worker := old.verified_worker;
    new.verification_notes := old.verification_notes;
    if old.account_type is not null and btrim(old.account_type) <> '' then
      new.account_type := old.account_type;
    end if;
    new.founding_user := old.founding_user;
    new.founding_number := old.founding_number;
    new.founding_trial_ends_at := old.founding_trial_ends_at;
    new.founding_price_lock := old.founding_price_lock;
    new.founding_locked_plan := old.founding_locked_plan;
    new.marketplace_pack_unlocked := old.marketplace_pack_unlocked;
  end if;
  return new;
end;
$$;
