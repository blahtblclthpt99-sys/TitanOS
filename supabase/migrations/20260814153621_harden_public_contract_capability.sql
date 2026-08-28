-- RECOVERY PROVENANCE: restored verbatim from the authoritative applied
-- migration ledger of TitanOS Supabase project xcfjpxcmokdfwkarwomy.

create or replace function public.get_public_contract_by_share_token(p_token text)
returns jsonb
language sql
security definer
set search_path = 'public'
as $$
  select case when c.id is null then null else jsonb_build_object(
    'id', c.id,
    'customer_name', c.customer_name,
    'title', c.title,
    'body', c.body,
    'status', c.status,
    'signed_at', c.signed_at,
    'owner_signed', (c.owner_signature is not null),
    'customer_signed', (c.customer_signature is not null)
  ) end
  from public.contracts c
  where c.share_token = p_token
    and p_token is not null
    and length(p_token) between 32 and 256
    and c.status in ('sent','signed')
  limit 1;
$$;

create or replace function public.sign_public_contract_by_share_token(
  p_token text,
  p_signature text,
  p_signature_image text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  c public.contracts%rowtype;
  clean_signature text := trim(coalesce(p_signature, ''));
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 256 then
    return null;
  end if;
  if clean_signature = '' or length(clean_signature) > 200 then
    raise exception 'Signature must be between 1 and 200 characters';
  end if;
  if p_signature_image is not null and length(p_signature_image) > 1000000 then
    raise exception 'Signature image is too large';
  end if;

  update public.contracts
  set customer_signature = clean_signature,
      customer_signature_image = coalesce(nullif(p_signature_image, ''), customer_signature_image),
      status = case when owner_signature is not null then 'signed' else status end,
      signed_at = case when owner_signature is not null then now() else signed_at end,
      updated_at = now()
  where share_token = p_token
    and status = 'sent'
  returning * into c;

  if c.id is null then
    select * into c
    from public.contracts
    where share_token = p_token and status in ('sent','signed')
    limit 1;
  end if;

  if c.id is null then return null; end if;

  return jsonb_build_object(
    'id', c.id,
    'customer_name', c.customer_name,
    'title', c.title,
    'body', c.body,
    'status', c.status,
    'signed_at', c.signed_at,
    'owner_signed', (c.owner_signature is not null),
    'customer_signed', (c.customer_signature is not null)
  );
end;
$$;

revoke all on function public.get_public_contract_by_share_token(text) from public;
revoke all on function public.sign_public_contract_by_share_token(text,text,text) from public;
grant execute on function public.get_public_contract_by_share_token(text) to anon, authenticated, service_role;
grant execute on function public.sign_public_contract_by_share_token(text,text,text) to anon, authenticated, service_role;
