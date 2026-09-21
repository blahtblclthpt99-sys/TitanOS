-- Allow trusted SECURITY DEFINER entitlement functions to update locked
-- profile columns while preserving fail-closed behavior for authenticated users.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and current_user not in ('postgres', 'service_role')
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
