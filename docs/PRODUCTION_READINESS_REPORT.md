# TitanOS — Production readiness report

**Date:** 2026-07-20  
**Stack:** Vite SPA + Vercel serverless API + Supabase (not Next.js)  
**Live:** https://titanos-web.vercel.app  

## Verification run (local)

| Gate | Result |
|------|--------|
| `npm run typecheck` | Pass (`checkJs: false` — JS app gate) |
| `npm run lint` | Pass |
| `npm test` (fees + hire) | Pass (24 tests) |
| `npm run build` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

## 1. Files changed (this hardening pass)

### Security / money
- `supabase/migrations/019_production_security_lockdown.sql` — payments status lockdown, hire accept gates, notifications, messages, activity read scope
- `api/functions/createPaymentLink.js` — invoice ownership + allowlisted return origin
- `api/functions/stripeWebhook.js` — idempotency fail-closed, refund handler, invoice amount/owner checks
- `api/functions/sendEmail.js` — rate limit + recipient allowlist (own email / owned customers)
- `api/functions/seedMarketplace.js` — admin or seed secret required
- `api/functions/portalRequestOtp.js` — IP + email rate limits, stronger OTP
- `api/functions/createNotification.js` — service-role cross-user notify (RLS-safe)
- `api/_lib/cors.js` — `resolveAppOrigin` / exported allowlist
- `api/_lib/auth.js` — `requireAdmin`
- `src/lib/paymentsApi.js` — webhook-only for succeeded/refunded
- `src/pages/Payments.jsx` — removed client “mark succeeded”
- `src/lib/hireApi.js` — owner gate + message filter
- `src/lib/notify.js` — API path for cross-user notifies

### Observability / deploy
- `src/lib/sentry.js`, `api/_lib/sentry.js`, `src/main.jsx` (existing + wired)
- `vercel.json` — CSP `connect-src` for Sentry + Mapbox events
- `.nvmrc` (`20`), `package.json` engines + `test` / `test:hire`
- `tsconfig.json` typecheck gate, `.github/workflows/ci.yml` typecheck + hire tests
- `.env.production.example`, `docs/DEPLOYMENT_CHECKLIST.md`

### Earlier in arc (still required)
- Migrations `016`–`018`, fee engine, rate limits, safe logging, CI, Sentry packages, `stripe` dependency

---

## 2. Security fixes

- Client can no longer mark payments `succeeded`/`refunded` (API + UI + RLS `019`)
- Payment links cannot attach another user’s invoice
- Checkout return URLs use allowlisted origins (not raw `Origin`)
- Stripe webhook: signature required; duplicate events skipped; missing idempotency table → 503
- Invoice mark-paid checks ownership + underpayment
- Open email relay restricted; marketplace seed locked; portal OTP rate-limited
- Hire: applicants cannot self-accept (`019`); owner check in `hireApplicant`
- Notifications: no client inserts for other users (API + service role)
- Messages: policies narrowed; activity feed no longer `SELECT true` for all
- CSP allows Sentry ingest; security headers already present

---

## 3. Performance improvements

- Existing route-level `lazy()` + manual chunks retained
- Charts remain dynamically imported (`PieChart` ~384 KB — isolated island)
- Asset cache headers / SPA rewrites unchanged and verified in `vercel.json`
- No large dead-code purge this pass beyond payment UI control removal

---

## 4. Monitoring added

- Client Sentry (`VITE_SENTRY_DSN`) + global error / rejection handlers
- Server Sentry (`SENTRY_DSN`) on payment, webhook, fees, email, OTP, seed, notifications
- `safeLog` for API errors without leaking DB strings from health

**Ops required:** set DSN(s) on Vercel Production + Preview.

---

## 5. Deployment changes

- Node `>=20 <25` + `.nvmrc`
- CI: typecheck → lint → fee tests → hire tests → build
- Install: `npm ci`
- CSP updated for Sentry
- Checklist updated for migrations **016–019**

**This session did not re-deploy production.** Prior live URL remains until you deploy these commits.

---

## 6. Database changes

| Migration | Purpose | Apply on Supabase? |
|-----------|---------|-------------------|
| `016_hire_applications_rls.sql` | Hire apps least-privilege | **Required** for hire |
| `017_fee_engine.sql` | Fee tables + RLS | **Required** for Admin Fees / DB rates |
| `018_stripe_webhook_idempotency.sql` | `stripe_webhook_events` | **Required** — webhook fails closed without it |
| `019_production_security_lockdown.sql` | Payments / hire / notify / messages / activity | **Required** for money + hire lockdown |

---

## 7. Stripe changes

- Signature verification (unchanged, strict)
- Idempotent event ledger (insert-before-side-effects)
- Refund event handling (`charge.refunded`)
- Ownership + amount checks before marking invoices paid
- Client status forgery path removed
- Dependency: `stripe` in `package.json`

---

## 8. Remaining risks

1. **Live production health (checked 2026-07-20):** `stripeConfigured: true` but **`webhookConfigured: false`** — set `STRIPE_WEBHOOK_SECRET` on Vercel or payments will never settle via webhook.
2. **Migrations 016–019 may not be applied** on the live Supabase project yet — verify in SQL editor.
3. **Sentry DSN** may be unset → monitoring no-op until configured.
4. **This branch may not be on production** until commit + `vercel deploy --prod`.
5. **Public storage bucket** (`titanos-uploads`) still readable — move to signed URLs for private resumes/docs.
6. **In-memory rate limits** are best-effort on serverless — add Vercel Firewall / Redis for OTP/email/AI.
7. **`createNotification`** still allows any authenticated user to notify any profile (rate-limited) — tighten to relationship checks if abused.
8. **No Stripe Connect / worker payouts** — platform fee collection only.
9. **Typecheck does not statically type all JSX** (`checkJs: false`).
10. **`.env.production` historically tracked** — rotate anon keys if the repo was shared.

---

## 9. Production readiness score

**78 / 100**

Local gates are green and critical money/hire paths are hardened in code. Ops apply + deploy + live webhook/Sentry proof remain.

---

## 10. Final verdict

### READY WITH MINOR RISKS

**Not** `PRODUCTION READY` under the mission’s absolute checklist until:

1. Apply migrations **016–019** on production Supabase  
2. Set `STRIPE_WEBHOOK_SECRET`, confirm webhook deliveries succeed  
3. Set `VITE_SENTRY_DSN` / `SENTRY_DSN`  
4. Commit + production deploy of this tree  
5. Run post-deploy smoke (auth → hire → payment link → webhook settle)

---

## Operator next steps (copy/paste)

```sql
-- In Supabase SQL editor, run in order:
-- 016_hire_applications_rls.sql
-- 017_fee_engine.sql
-- 018_stripe_webhook_idempotency.sql
-- 019_production_security_lockdown.sql
```

```bash
npm run typecheck && npm run lint && npm test && npm run build
npx vercel deploy --prod --yes
```

Stripe Dashboard → Webhooks → `https://titanos-web.vercel.app/api/functions/stripeWebhook`  
Events: `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed`, `charge.failed`, `charge.refunded`
