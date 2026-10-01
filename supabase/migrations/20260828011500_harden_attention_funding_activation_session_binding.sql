-- Titan Attention funding activation trust boundary.
-- Stripe payment truth enters through the Cloudflare webhook using service_role only.

create or replace function public.activate_attention_campaign_funding_service(
  p_campaign_id uuid,
  p_checkout_session_id text,
  p_amount_cents bigint
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.attention_campaigns%rowtype;
begin
  if p_campaign_id is null then
    raise exception 'campaign_id_required';
  end if;

  if p_checkout_session_id is null or btrim(p_checkout_session_id) = '' then
    raise exception 'checkout_session_required';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'funding_amount_invalid';
  end if;

  select *
    into v_campaign
    from public.attention_campaigns
   where id = p_campaign_id
   for update;

  if not found then
    raise exception 'campaign_not_found';
  end if;

  if v_campaign.stripe_checkout_session_id is null
     or v_campaign.stripe_checkout_session_id <> p_checkout_session_id then
    raise exception 'checkout_session_mismatch';
  end if;

  if p_amount_cents <> v_campaign.total_budget_cents then
    raise exception 'funding_amount_mismatch';
  end if;

  if v_campaign.status = 'active'
     and v_campaign.funded_cents = v_campaign.total_budget_cents then
    return 'already_active';
  end if;

  if v_campaign.status <> 'funding' then
    raise exception 'campaign_not_funding';
  end if;

  if v_campaign.funded_cents <> 0 then
    raise exception 'campaign_funding_state_invalid';
  end if;

  update public.attention_campaigns
     set funded_cents = p_amount_cents,
         funded_at = now(),
         status = 'active',
         updated_at = now()
   where id = p_campaign_id;

  return 'activated';
end;
$$;

revoke all on function public.activate_attention_campaign_funding_service(uuid, text, bigint) from public;
revoke all on function public.activate_attention_campaign_funding_service(uuid, text, bigint) from anon;
revoke all on function public.activate_attention_campaign_funding_service(uuid, text, bigint) from authenticated;
grant execute on function public.activate_attention_campaign_funding_service(uuid, text, bigint) to service_role;
