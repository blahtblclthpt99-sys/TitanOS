-- Keep precise job-search origin private to the signed-in account.
alter table public.job_match_preferences
  add column if not exists search_lat double precision,
  add column if not exists search_lng double precision;

alter table public.job_match_preferences
  drop constraint if exists job_match_preferences_search_lat_range,
  add constraint job_match_preferences_search_lat_range check (search_lat is null or (search_lat >= -90 and search_lat <= 90));

alter table public.job_match_preferences
  drop constraint if exists job_match_preferences_search_lng_range,
  add constraint job_match_preferences_search_lng_range check (search_lng is null or (search_lng >= -180 and search_lng <= 180));
