-- TitanOS Google Play recovery: enforce the same upload contract on the
-- storage bucket that the Android client enforces locally.
update storage.buckets
set
  public = false,
  file_size_limit = 12582912,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf'
  ]::text[]
where id = 'titanos-uploads';

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'titanos-uploads') then
    raise exception 'titanos-uploads bucket is missing';
  end if;
end
$$;
