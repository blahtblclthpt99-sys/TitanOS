# TitanOS — Complete Production Inspection Report

**Date:** 2026-07-22 (America/Chicago)  
**Product:** TitanOS (`titanfieldos`) — Vite SPA + Vercel serverless + Supabase + Capacitor  
**Live:** https://titanos-web.vercel.app  
**Standard:** Public-launch readiness — verify, repair, document. No assumptions.

---

## Executive verdict

**NOT READY for unrestricted public launch.**

In-tree quality is strong after this inspection’s repairs. Production money settlement and DB privilege locks are still blocked by **ops** (webhook secret, migrations 016–021, deploy of hardened tree, Sentry).

| Gate (this session) | Result |
|---------------------|--------|
| Typecheck | Pass |
| ESLint | Pass |
| Unit tests | **40 pass** (fees, hire, payments, driver, money, portal OTP) |
| Production build | Pass (~25s, lazy-routed chunks) |
| npm audit (prod) | **0 vulnerabilities** |
| Live health | API/Supabase/Stripe key OK · **`webhookConfigured: false`** |

**Estimated readiness after this pass:** ~68/100 code · ~45/100 live ops · **overall ~62/100**.

Closest honest status after ops completion: **READY WITH MINOR RISKS**.

---

## Phase coverage (what was inspected)

| Area | Method | Depth |
|------|--------|-------|
| Routes / pages (~50+ authenticated + public) | Static inventory from `App.jsx` + `TabStack.jsx` | Full map |
| API handlers (~25) | Security review of money/auth/portal/AI | Deep on money + portal |
| Auth (login/register/reset/OAuth/portal OTP) | Code path + prior certs | High |
| Payments / Stripe / fees | Code fix + tests + live health | High |
| Driver Hub | Prior repair + tests | High |
| Invoices / Estimates forms | Validation added | High |
| Settings / profile / deletion | Static | Medium |
| Labs/demo features | Honesty banners / copy | Documented |
| UX / a11y | Portal labels + patterns | Medium (not full WCAG audit) |
| Performance | Build chunk map; routes already lazy | Medium (no Lighthouse CI run this session) |
| Browser E2E click-through of every control | **Not fully executed** | Residual — see recommendations |

Honest limit: a true “every button/link” interactive matrix needs staged E2E (Playwright) against a seeded environment. This inspection maximized **static analysis + security fixes + automated gates + live health**.

---

## Critical issues

| ID | Issue | Status |
|----|-------|--------|
| **C1** | Live Stripe webhook secret missing — checkouts cannot settle (`webhookConfigured: false`) | **OPEN (ops)** — set `STRIPE_WEBHOOK_SECRET` on Vercel Production + redeploy |
| **C2** | Migrations 016–021 (privilege/money/RLS/upload privacy) not proven on production DB | **OPEN (ops)** — apply/verify in Supabase |
| **C3** | Hardened local tree may not match deployed `main` | **OPEN (ops)** — commit + prod deploy when ready |
| **C4** | Invoice underpayment via client `amount` + fee covering shortfall could mark invoice paid | **FIXED in code** — `createPaymentLink` forces `balance_due`; webhook compares **base** vs due |
| **C5** | Portal OTP logged in cleartext when Resend unset | **FIXED** — fail closed (503), hash OTP at rest, never log codes |

---

## High-priority issues

| ID | Issue | Status |
|----|-------|--------|
| **H1** | AI `aiExecuteAction` could attach foreign `customer_id` / negative money | **FIXED** — ownership check + money sanitize + rate limit |
| **H2** | Referral client fallback forged `is_paying` / `completed` after 403 | **FIXED** — server-only invoke |
| **H3** | `sendEmail` / `sendFollowUp` stub logged PII and returned success | **FIXED** — no body/recipient dump; **503** when Resend unset |
| **H4** | Invoice/Estimate line items accepted negatives | **FIXED** — `moneyDocument` validation |
| **H5** | Portal review spam / no rate limits on portal pay/data | **FIXED** — duplicate review guard + rate limits |
| **H6** | CI omitted `test:payments` / `test:driver` | **FIXED** — CI runs payments, driver, money/OTP |
| **H7** | Sentry DSNs unset on Vercel | **OPEN (ops)** |
| **H8** | In-memory rate limits weak across serverless instances | **Residual** — need Redis/WAF |
| **H9** | Account deletion not automated (Settings) | **OPEN (product)** |

---

## Medium-priority issues

| ID | Issue | Notes |
|----|-------|-------|
| **M1** | Labs/demo surfaces (Driver directory, Escrow, Deals, etc.) | Honesty banners; not production marketplace |
| **M2** | Driver Hub shift data primarily localStorage | Tax sync when signed in; last-write-wins |
| **M3** | `FREE_DURING_BETA` may unlock features | Confirm before paid launch |
| **M4** | Typecheck `checkJs: false` | JS gate, not full JSX typing |
| **M5** | Android `minifyEnabled false` | Larger AAB residual |
| **M6** | Dual fee preview vs server Fee Engine | Server is source of truth at checkout |
| **M7** | Chart island weight (~PieChart) | Accepted lazy island |
| **M8** | Portal OTP pepper falls back to service role | Prefer dedicated `PORTAL_OTP_PEPPER` |
| **M9** | Customer Portal a11y gaps | **Partially fixed** (label/`htmlFor`/autocomplete) |
| **M10** | Unrouted `MarketplaceApps.jsx` | Dead/orphan page — cleanup candidate |

---

## Low-priority improvements

| ID | Issue |
|----|-------|
| **L1** | Estimate line-item remove buttons still need stronger `aria-label`s in places |
| **L2** | Full Lighthouse CI (perf/a11y/SEO) not in pipeline |
| **L3** | Cross-browser matrix not automated |
| **L4** | Health endpoint exposes config booleans (acceptable for ops) |
| **L5** | IRS mileage rate constant needs annual update |

---

## Files modified (this inspection)

### Security / money / portal
- `api/_lib/portalOtp.js` — **new** OTP hash helpers
- `api/functions/portalRequestOtp.js` — no OTP logs; require Resend; store hash
- `api/functions/portalVerifyOtp.js` — hashed verify + legacy transition
- `api/functions/createPaymentLink.js` — invoice charges use server `balance_due`
- `api/functions/stripeWebhook.js` — underpayment check uses base amount vs due
- `api/functions/aiExecuteAction.js` — ownership, sanitize, rate limit, generic errors
- `api/functions/sendEmail.js` — fail closed without Resend; no content logs
- `api/functions/sendFollowUp.js` — fail closed without Resend
- `api/functions/portalLeaveReview.js` — rate limit + one review per job
- `api/functions/portalPayInvoice.js` — rate limit; clean amount/Stripe guards
- `api/functions/portalGetData.js` — CORS + rate limit
- `src/lib/referralApi.js` — removed forgeable paying fallback

### Forms / UX / a11y
- `src/lib/moneyDocument.js` — **new** shared line/tax validation
- `src/pages/Invoices.jsx` — validate before save
- `src/pages/Estimates.jsx` — validate before save + toasts
- `src/pages/CustomerPortal.jsx` — proper labels, autocomplete, alerts

### Quality / CI
- `package.json` — `test:money` + included in `npm test`
- `.github/workflows/ci.yml` — payments, driver, money tests
- `scripts/money-document.test.mjs`, `scripts/portal-otp.test.mjs` — **new**

### Report
- `docs/PRODUCTION_INSPECTION_REPORT.md` — this document

---

## Why each change was made

1. **OTP** — Auth secrets must never appear in logs; storage should be hashed; missing mail provider must fail closed.
2. **Invoice amount** — Callers must not pick an arbitrary charge that, with fees, satisfies a loose webhook compare.
3. **AI actions** — Service-role inserts must not attach foreign customers or garbage money values.
4. **Referrals** — Client must not self-award paying status.
5. **Email stubs** — False “sent” + PII in logs hide misconfiguration and leak data.
6. **Line items** — Negative qty/price corrupt AR and tax math.
7. **Portal limits / reviews** — Stolen tokens and spam need soft guards even before Redis.
8. **CI** — Money and Driver Hub regressions must fail the merge gate.

---

## Performance notes

- Routes already use lazy loading (`App.jsx` / `TabStack.jsx`).
- Production build succeeds with many route-level chunks; main CSS ~122 KB (~22 KB gzip).
- No new heavy dependencies added.
- Residual: chart islands, unminified Android release, no automated Lighthouse budget.

---

## UX notes (first-time user)

**Strengths:** Clear More menu, honesty banners on Labs, Driver Hub tips/tooltips, empty/error states on many entity pages.

**Friction:** Many Labs entries can feel like core product; Settings account deletion is support-only; email features need Resend or they now correctly error.

**Navigation:** Tab stack + More is dense but consistent; deep links for invoices/customers work.

---

## Remaining recommendations (ordered)

1. **Ops P0:** Add `STRIPE_WEBHOOK_SECRET` (`whsec_…`) on Vercel → redeploy → confirm health `webhookConfigured: true`.
2. **Ops P0:** Apply/verify Supabase migrations **016–021**; smoke-test checkout → webhook → `payments.status=succeeded` + invoice paid.
3. **Ops P0:** Commit + deploy this hardened tree; set Sentry DSNs.
4. **Ops P1:** Set `RESEND_API_KEY` + `PORTAL_OTP_PEPPER` for portal/email.
5. **Eng P1:** Playwright smoke suite (auth, invoice create, checkout stub, portal OTP with test mail).
6. **Eng P2:** Shared Redis rate limiter; unique DB constraint on `(job_id, customer_id)` reviews.
7. **Product:** Decide Labs vs GA; finish account deletion / GDPR export; remove or route `MarketplaceApps.jsx`.

---

## Final statement

TitanOS has been **thoroughly inspected at the architecture, security, money, portal, form-validation, CI, and build layers**, with **significant defects repaired in code**. It is **not production-certified** until webhook + migrations + deploy are verified live. Do not market unrestricted public launch until C1–C3 are closed and an end-to-end payment smoke test passes.
