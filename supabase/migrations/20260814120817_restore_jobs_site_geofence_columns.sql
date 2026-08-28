alter table public.jobs add column if not exists site_lat double precision;
alter table public.jobs add column if not exists site_lng double precision;
alter table public.jobs add column if not exists geofence_m integer not null default 150;

alter table public.jobs drop constraint if exists jobs_site_lat_range;
alter table public.jobs add constraint jobs_site_lat_range check (site_lat is null or site_lat between -90 and 90);
alter table public.jobs drop constraint if exists jobs_site_lng_range;
alter table public.jobs add constraint jobs_site_lng_range check (site_lng is null or site_lng between -180 and 180);
alter table public.jobs drop constraint if exists jobs_geofence_m_range;
alter table public.jobs add constraint jobs_geofence_m_range check (geofence_m between 25 and 5000);

comment on column public.jobs.site_lat is 'Job-site latitude used for maps and geofence check-in validation.';
comment on column public.jobs.site_lng is 'Job-site longitude used for maps and geofence check-in validation.';
comment on column public.jobs.geofence_m is 'Allowed job-site check-in radius in meters.';
