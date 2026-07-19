# TitanOS Production Inspection Report

Date: 2026-07-19  
Scope: End-to-end reliability, security, money integrity, and release readiness.

This pass **fixed critical production blockers** and documented remaining work. A full manual device-lab / every-page clickthrough still requires human QA.

---

## Fixed in this pass (shipped / ready to deploy)

| Severity | Issue | Fix |
|----------|--------|-----|
| CRITICAL | `sendEmail` / `sendFollowUp` open relays | JWT required via `api/_lib/auth.js`; follow-ups scoped to owner |
| CRITICAL | Portal marked invoices paid without Stripe | Stub removed; returns 503 until Checkout is configured |
| CRITICAL | OCR / Mapbox / attachReferral unauthenticated | JWT required; referral `userId` bound to JWT |
| HIGH | CORS reflected any Origin + credentials | Allowlist in `api/_lib/cors.js` |
| HIGH | Outstanding AR undercounted | `finance-metrics.js` includes `partial` + `balance_due ?? total` |
| HIGH | `is_pro` mapped to Business (fee undercharge) | Client + server plan resolvers aligned → Premium, not Business |
| HIGH | Contracts enumerable by anon | Migration `012_security_hardening.sql` + token RPCs; longer share tokens |
| HIGH | Silent invoice/job save failures | Toasts + catch on Invoices create / Jobs complete |
| MEDIUM | AI markdown link XSS | Safe `https`/`http`/`/` links only in AIAssistant |
| MEDIUM | Upload type/size unchecked | MIME allowlist + 12MB + user-prefixed path |
| MEDIUM | No Stripe webhook path | Added `api/functions/stripeWebhook.js` (needs `STRIPE_WEBHOOK_SECRET` + raw body) |

---

**CRITICAL** — Stripe webhook must use verified `constructEvent` only (no relaxed mode).  
**Updated:** `stripeWebhook.js` now refuses unverified events and requires a raw body.

## Remaining (must track for public launch)

### P0 — Money system
1. **Stripe Connect** — Checkout currently charges the platform account; workers are not paid out. Implement Express Connect + `application_fee_amount` / destination charges.
2. **Webhook raw body** — Vercel may pre-parse JSON; configure raw body for `/api/functions/stripeWebhook` or use Stripe’s recommended adapter. Until verified, do not rely on webhook in production.
3. **Remove/gate manual “Mark payment succeeded”** in Payments UI.

### P0 — Data access
4. Run **`012_security_hardening.sql`** in Supabase (drops broad contracts policy).
5. **Hire applications RLS** (`USING (true)`) — restrict to job owner + applicant.
6. **Storage bucket** `titanos-uploads` is public — migrate to private + signed URLs.

### P1 — Auth & abuse
7. Registration sets `email_confirm: true` — enable real verification.
8. Portal OTP: rate limit + stronger RNG than `Math.random`.
9. Rate limiting on all public/portal endpoints.

### P1 — Reliability
10. Add catch/toast on Estimates, Finances, Escrow, Employees, Loyalty mutations.
11. AuthContext race: request-id / ignore stale `onAuthStateChange` responses.
12. Payments/escrow **localStorage fallback** should not present as “saved live”.

### P2 — UX / a11y / perf
13. Manual QA matrix: every page on phone/tablet/desktop (this pass did not replace device testing).
14. Keyboard/focus audit on dialogs and mobile nav.
15. Bundle: PieChart / AIAssistant chunks are large — further route-level splitting.
16. `npm audit`: lodash, picomatch, postcss, react-router advisories — run `npm audit fix` and retest.

### P2 — Product honesty
17. Escrow UI should say **“tracking only”** until real fund holds exist.
18. Tax Center: update brackets for current tax year; label estimates clearly.

---

## What already looked solid
- No hardcoded API secrets in repo
- Core entity RLS ownership patterns on customers/jobs/invoices
- App shell auth gate for private routes
- JWT checks on Titan AI / createPaymentLink / aiExecuteAction
- Build succeeds after money/time feature set

---

## SQL to run (in order if not already)
1. `009_phase66.sql` (if needed)
2. `010_phase100.sql`
3. `011_job_summaries.sql`
4. **`012_security_hardening.sql`** ← required for contract privacy

## Env vars for launch
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_ORIGIN`
- `RESEND_API_KEY` (email)
- `CORS_ALLOWED_ORIGINS` (extra domains, comma-separated)
- `OPENAI_API_KEY` / `MAPBOX_ACCESS_TOKEN` (optional paid features)

---

## Verdict
**Not yet “stable public release”** until Stripe Connect + verified webhooks + migration 012 + storage privacy are done.  
**Much safer for closed beta** after deploying this security pass and running SQL 012.
