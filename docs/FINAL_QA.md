# FINAL QA — TitanOS production readiness

Honest status: **controlled beta**, not “zero medium severity remaining.”

North star: [`FINAL_OBJECTIVE.md`](./FINAL_OBJECTIVE.md) — OS feel + ship gate. This checklist is how we prove readiness without lowering that bar.

## Checklist

### Automated (CI / local)

- [x] `npm test` (includes `test:final-qa`)
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] `npm run test:e2e` (Chromium desktop smoke after isolated-config production build)
- [x] Chromium Pixel 5 smoke (`npx playwright test --project=chromium-mobile`)
- [x] `npm run test:integration-merge` (TitanOS + Titan AI + Base44 + Cursor closure)

### Structural (enforced by `scripts/final-qa.test.mjs`)

- [x] Nav paths ↔ `TabStack` route map
- [x] ExportMenu on Estimates, Leads, Payments, Tax Center, Contracts (+ existing Jobs/Invoices/Customers/Finances/Reports/Analytics)
- [x] Migrations 031–036 on disk; hardening requires 031+032
- [x] `autoTripStart` stops watch when DoorDash owns GPS
- [x] Escrow honesty banner + 032 escrow protect present
- [x] Referrals paused (off nav; `referrals: false`); modules subscription-only

### Manual / ops (owner)

- [ ] Apply migrations **031–037** on production Supabase (esp. **032**, **035**, **037**)
- [ ] `npm run test:db-security` against that project
- [ ] One real Stripe Checkout → webhook marks payment succeeded
- [ ] Signed-in pass: every nav screen, primary buttons, menus, permission gates
- [ ] Device: GPS transitions, poor reception, background, offline recovery, interrupted session
- [ ] Slow network / upload / notification / search / animation / responsive spot-checks
- [ ] AI allowlisted intents only (already unit-tested; spot-check UI honesty)

## Coverage map (what “test every X” means here)

| Surface | Automated | Manual still needed |
|---------|-----------|---------------------|
| Screens / menus / nav | Route closure + smoke | Auth click-through |
| Permissions / RLS | Hardening + optional `test:db-security` | Live project after 032 |
| APIs | Unit + rate-limit / error hygiene | Staging load |
| Payments | Webhook policy + escrow honesty | Live Checkout settle |
| GPS | Owner + auto-trip stop contract | Phone / poor GNSS |
| Export / search / AI / offline | Node packs | Spot-check UI |
| Notifications / uploads / animations | Partial structural | Device QA |
| Background / interrupted sessions | Session persist tests | Capacitor device |
| Founding 100 / marketplace / referrals | Structural gates | Apply 035–036 + live flag check |

## Residual risk (do not erase)

1. Migrations **031–036** may not be applied on the live Supabase project yet (Founding 100 needs **035**; subscription-only modules need **036**).
2. No authenticated Playwright suite for Checkout → settle.
3. Windows local Playwright can hang; prefer CI Chromium.
4. Labs items (Job Holds, Local Deals) are intentionally incomplete — labeled Soon.
5. Referral program is paused by design — do not market referral rewards until `referrals` is re-enabled.

## Commands

```bash
npm test
npm run test:final-qa
npm run lint && npm run typecheck && npm run build
npm run test:e2e
# after migrations applied + secrets:
npm run test:db-security
```

Source rule: `.cursor/rules/final-qa.mdc`.
