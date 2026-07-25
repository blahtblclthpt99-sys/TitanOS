# TitanOS Fee Engine

Centralized, configurable revenue pricing. **All live charges are calculated on the server** (`api/functions/createPaymentLink.js` → `api/_lib/feeConfig.js` → `shared/feeEngine.js`). Browser fee math is display-only.

## Architecture

| Layer | Role |
|-------|------|
| `shared/feeEngine.js` | Pure calculation (%, flat, min/max, tiers, promo, tax, buyer/seller) |
| `api/_lib/feeConfig.js` | Load/cache DB rules; seed fallback; audit log write |
| `api/functions/calculateFee.js` | Authenticated fee quote |
| `api/functions/adminFees.js` | Admin list/upsert/schedule/disable/history/rollback |
| `supabase/migrations/017_fee_engine.sql` | Categories, rules, history, calculation logs + RLS |
| `src/pages/AdminFees.jsx` | Admin UI (`/admin/fees`) |
| `src/lib/platformFee.js` | UI preview helper (not trusted for charging) |

## Categories (seeded)

Marketplace Sales, Driver Services, Service Requests, Subscriptions, Premium Membership, Featured Listings, Promoted Posts, Advertising.

Service request rules are segmented by `context_key` = plan id (`customer`, `worker_free`, `worker_premium`, `business`).

## Apply migration

Run `017_fee_engine.sql` in Supabase SQL editor (or CLI). Until applied, server uses **seed defaults** matching launch plan rates (8% / 2.5% / 1.5% / 0%).

## Tests

```bash
npm run test:fees
```

## Security

- Client cannot set `platform_fee` / totals on checkout — server recalculates.
- Admin APIs require admin JWT + profile role.
- Fee calculation logs are append-only audit trail (best-effort if table missing).

## Extending

Add country/role/seasonal pricing via new `context_key` values or `tiers` / `promo` JSON on rules — no core rewrite required. Prefer new rule versions over editing rows in place (history + rollback).
