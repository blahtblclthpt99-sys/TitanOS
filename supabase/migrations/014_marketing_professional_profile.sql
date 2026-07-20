-- Marketing preferences + professional profile JSON on profiles
alter table public.profiles
  add column if not exists marketing_prefs jsonb not null default '{}'::jsonb;

alter table public.profiles
  add column if not exists professional_profile jsonb not null default '{}'::jsonb;

comment on column public.profiles.marketing_prefs is 'Email/SMS/push marketing channels, frequency, and categories';
comment on column public.profiles.professional_profile is 'Public professional profile payload (bio, portfolio, skills, etc.)';
