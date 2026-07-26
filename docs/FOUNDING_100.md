# Founding 100 — free app, fees still apply

## Policy

| Who | Membership | Transaction fees | After beta |
|-----|------------|------------------|------------|
| First **100** users | Free forever (`founding_user` + `lifetime_premium`) | Still charged (plan fee rate) | Keep free membership |
| User **101+** | PayPal Premium / Business when beta closes | Charged | Must pay for Premium tools |

When the 100th founding slot is claimed, `platform_launch.beta_active` flips to **false** and membership checkout goes live.

## Apply

Run in Supabase SQL Editor:

`supabase/migrations/035_founding_100_beta.sql`

(or append after 031–034)

## How it works

1. `claim_founding_slot(user_id)` — atomic advisory lock, assigns `founding_number` 1–100  
2. Trigger on `profiles` INSERT auto-claims (email + OAuth)  
3. Backfill assigns earliest existing profiles up to the cap  
4. `/api/functions/featureFlags` returns `launch: { betaActive, foundingClaimed, spotsRemaining, membershipPaymentsLive }`  
5. Client `isFreeDuringBeta()` / `getPlanCheckoutUrl()` hide PayPal until beta closes  

## Ops checklist after 100

- [ ] Confirm `platform_launch.beta_active = false`  
- [ ] Confirm PayPal NCP links in `src/lib/plan.js`  
- [ ] Spot-check Pricing shows paid CTAs  
- [ ] Founding users still see “Founding #N · free app (fees apply)”  
