# Founding 100 — first month free, then price lock

## Policy

| Who | Membership | Transaction fees | After trial |
|-----|------------|------------------|------------|
| First **100** signups | **Month 1 free** + Founder badge | Still charged | Pay **locked** founding rate forever (default Pro **$9.99**/mo) |
| User **101+** | Starter **$4.99** / Pro **$9.99** / Business **$19.99** | Charged | Normal catalog prices |

Founding enrollment closes when the 100th slot is claimed (`platform_launch.beta_active = false`). Checkout stays live for everyone.

## Plans

| Plan | Price | Notes |
|------|-------|--------|
| Customer | $0 | Hire only |
| Free | $0 | Limited worker tools, 8% fee |
| Starter | **$4.99** | Lite tools, no AI / Driver AI / Titan Radio persist |
| Pro | **$9.99** | ⭐ Most Popular — full Driver Hub, AI, apps |
| Business | **$19.99** | Teams + fleet |

## Apply

1. `supabase/migrations/035_founding_100_beta.sql` (if not applied)
2. `supabase/migrations/037_founding_trial_price_lock.sql`

## How it works

1. `claim_founding_slot(user_id)` assigns slot 1–100, sets `founding_trial_ends_at` (+30 days), `founding_price_lock = 9.99`, `founding_locked_plan = worker_premium`
2. Does **not** grant free-forever `lifetime_premium` (legacy founders who already have it keep it)
3. Client `isFoundingTrialActive()` unlocks Pro features during the free month
4. After trial, pay at locked price via PayPal; `paying_subscriber` keeps access
5. `/api/functions/featureFlags` → `launch.spotsRemaining`, `membershipPaymentsLive: true`

## Ops checklist

- [ ] Create PayPal NCP buttons for **$4.99 / $9.99 / $19.99** and update URLs in `src/lib/plan.js` `PAYPAL_CHECKOUT`
- [ ] Apply migration **037**
- [ ] Confirm Pricing copy: first month free → lock
- [ ] After 100: enrollment closed; founders keep price lock
