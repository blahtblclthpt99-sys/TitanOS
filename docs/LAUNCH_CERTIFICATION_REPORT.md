# TitanOS — Final Launch Certification Report

**Date:** 2026-07-20 (America/Chicago)  
**Product:** TitanOS (`titanfieldos`) — Vite SPA + Vercel serverless + Supabase  
**Live URL:** https://titanos-web.vercel.app  
**Standard:** Secure, reliable, scalable, maintainable, professional — **no approval without verification**.

---

## 1. Executive summary

TitanOS has **strong in-tree money and auth hardening**, a **passing local quality gate**, and a **live site with security headers + healthy API/Supabase**. It is **not launch-certified** for unrestricted public release.

**Blockers that prevent PRODUCTION CERTIFIED:**

1. Hardened tree is **not confirmed deployed** to production (git `main` lags large local/untracked changes).
2. Live health: **`webhookConfigured: false`** — Stripe checkouts cannot settle.
3. Supabase migrations **016–021** apply status on production is **unverified**.
4. Sentry DSNs are **not set** on Vercel — monitoring code is a no-op.
5. Critical privilege bugs were found **during this certification** and fixed in code (role/plan escalation, invoice paid, OTP brute-force, signup export key) — they require **migration 021 + deploy** to take effect.

**Final decision: NOT READY** (see §14). Closest honest alternate after ops completion: **READY WITH MINOR ISSUES**.

---

## 2. Problems found (by severity)

### Critical

| ID | Problem | Evidence | Status |
|----|---------|----------|--------|
| C1 | Client could escalate `profiles.role` / plan entitlements | RLS update + `updateMe` allowlist | **Fixed in code** (`auth.js` + migration `021`) — **OPS: apply 021** |
| C2 | Fee fraud via client `plan_tier` / `account_type` | `createPaymentLink` trusts profile fields | **Fixed in code** (client strip + DB trigger) — **OPS: apply 021** |
| C3 | Stripe webhook secret missing on live | Health `webhookConfigured: false` (verified 2026-07-20) | **OPS-ONLY** |
| C4 | Migrations 016–021 not verified on prod DB | Untracked/local SQL; apply unknown | **OPS-ONLY** |
| C5 | Hardened tree not on production | Dirty working tree vs `origin/main` @ older SHA | **OPS: deploy** |

### High

| ID | Problem | Status |
|----|---------|--------|
| H1 | Invoice UI could set `paid` without webhook | **Fixed** (UI + trigger `021`) |
| H2 | Portal OTP verify unrestricted → brute force | **Fixed** (rate limits) |
| H3 | Webhook claim-then-fail left events stuck | **Fixed** (release claim on process failure) |
| H4 | `signup-emails` GET accepted service role as export key + `CORS *` | **Fixed** (dedicated key only + shared CORS) |
| H5 | Public uploads bucket until 020 applied | **Code ready** — **OPS: apply 020** |
| H6 | Costly AI without rate limit | **Fixed** (`titanAI` 30/min) |
| H7 | In-memory rate limits weak on serverless | Residual — need WAF/Redis |
| H8 | `.env.production` historically in git | Staged removal — **rotate keys if repo shared** |

### Medium

| ID | Problem | Status |
|----|---------|--------|
| M1 | Message recipient could rewrite body | **Fixed** (trigger in `021`) |
| M2 | PieChart island ~384 KB gzip ~106 KB | Accepted lazy island; residual weight |
| M3 | Labs/honest-but-incomplete features | Honesty banners present |
| M4 | No Stripe Connect / worker payouts | Product gap |
| M5 | `createNotification` related-peer spam (40/min) | Residual |
| M6 | Typecheck uses `checkJs: false` | JS gate, not full JSX typing |

### Low

| ID | Problem | Status |
|----|---------|--------|
| L1 | Hire board intentionally world-readable | By design |
| L2 | Health exposes config booleans | Acceptable for ops |
| L3 | Cross-browser matrix not automated in CI | Manual residual |
| L4 | Account deletion / GDPR workflow incomplete | Product follow-up |

---

## 3. Severity rating summary

- **Critical open (ops):** C3, C4, C5 (+ C1/C2 until 021 applied on DB)  
- **High open (ops/residual):** H5, H7, H8  
- **Medium/Low:** as listed  

---

## 4. Fixes completed (this certification pass)

| Fix | Files |
|-----|-------|
| Strip privileged profile fields from client updates | `src/api/auth.js` |
| DB triggers: lock role/plan; invoice paid; message body | `supabase/migrations/021_privilege_money_integrity.sql` |
| Remove invoice `paid` from client status options | `src/pages/InvoiceDetail.jsx` |
| Portal OTP verify rate limits + format check | `api/functions/portalVerifyOtp.js` |
| Webhook idempotency claim release on failure | `api/functions/stripeWebhook.js` |
| Signup email export: never use service role; CORS allowlist | `api/signup-emails.js` |
| Titan AI rate limit + Sentry import | `api/functions/titanAI.js` |
| Private/public upload paths (prior) | `src/api/integrations.js`, migration `020` |
| Payment/hire/fee security suite | `scripts/*-security.test.mjs`, fee engine tests |

**Prior hardening still required on prod:** migrations `016–020`, client payment webhook-only, hire RLS, fee engine, Sentry wiring, CSP, CI gates.

---

## 5. Security score: **62 / 100**

**Why not higher:** live webhook unset; migrations unverified; privilege bugs existed until this pass; serverless rate limits are soft; monitoring not operational; deploy parity unverified.  
**Why not lower:** signature-verified Stripe path; CORS allowlist; security headers verified live (CSP/HSTS/XFO); client paid-status blocked in code; hire/payment unit tests pass.

---

## 6. Performance score: **74 / 100**

**Verified:** production build succeeds; route-level lazy loading; manual chunks; asset cache headers in `vercel.json`; indexes in migration `020`.  
**Drag:** `PieChart` ~384 KB; heavy `supabase`/`react-vendor` chunks; no CDN image pipeline beyond static assets.

---

## 7. UX score: **71 / 100**

**Verified in code:** ErrorBoundary, loaders, empty/error states, feature honesty banners, session expiry banner, mobile nav/dock, status feedback toasts.  
**Not fully verified:** first-run onboarding polish, full a11y audit (WCAG), cross-browser, slow-network journey testing.

---

## 8. Reliability score: **58 / 100**

**Verified:** health deep check supabase `ok`; fail-closed payments without checkout URL; global client error handlers; webhook fail-closed without idempotency table.  
**Drag:** webhook not configured live; monitoring no-op without DSN; migration apply unknown; no proven backup drill in this session; deploy rollback not exercised.

---

## 9. Scalability score: **55 / 100**

| Users | Assessment |
|------:|------------|
| 1k | Feasible on current Vercel + Supabase Free/Pro |
| 10k | Feasible with indexes (020) + connection pooling |
| 100k | Needs Redis rate limits, stricter query budgets, storage CDN |
| 1M | Not ready — single-region serverless + in-memory limits + large client bundles |

---

## 10. Code quality score: **76 / 100**

**Verified:** lint clean; typecheck gate pass; 28 unit tests pass; modular API `_lib`; honest data-source tagging.  
**Drag:** large JS surface without `checkJs`; mixed feature maturity; uncommitted sprawl vs `main`.

---

## 11. Production readiness score: **61 / 100**

Local gates are green; live site is up with headers; **money settlement and DB lockdown on production are not proven**.

---

## 12. Remaining risks

1. **`STRIPE_WEBHOOK_SECRET` unset** on Vercel Production (verified).  
2. **Apply migrations 016→021** on production Supabase (unverified).  
3. **Deploy this working tree** to production (unverified).  
4. **Set Sentry DSNs** and confirm an event appears.  
5. **Rotate** historically committed publishable keys if the repo was shared.  
6. **Enable Vercel Firewall / Upstash** for OTP, AI, email.  
7. **Backup/PITR** confirmation in Supabase dashboard.  
8. **No automated E2E** for auth → hire → pay → webhook.

---

## 13. Recommended future improvements

1. E2E Playwright: auth, hire ACL, Stripe test-mode webhook settle.  
2. Redis/Upstash rate limiting shared across instances.  
3. Stripe Connect for worker payouts.  
4. Account deletion + data export (privacy).  
5. Enable `checkJs` incrementally or migrate critical modules to TS.  
6. Split PieChart further / lighter chart lib for mobile.  
7. Signed URL refresh API for private documents.  
8. Commit hygiene: one PR with migrations + API + client security together.

---

## 14. Final decision

# NOT READY

**Do not announce unrestricted public launch** until at least:

1. Apply **016–021** on production Supabase  
2. Set **`STRIPE_WEBHOOK_SECRET`** and confirm health `webhookConfigured: true`  
3. **`npx vercel deploy --prod --yes`** of this tree  
4. Smoke: checkout → webhook 200 → payment `succeeded`  
5. Set Sentry DSN and capture a test error  

After those five, re-score. Expected posture: **READY WITH MINOR ISSUES** (WAF, E2E, Connect, a11y). **PRODUCTION CERTIFIED** requires those plus monitoring proof, backup proof, and break-test sign-off.

---

## Verification appendix (this session)

| Check | Result |
|-------|--------|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm test` (fees+hire+payments = 28) | Pass |
| `npm run build` | Pass (prior run this session) |
| Live `GET /api/functions/health?deep=1` | `ok`, supabase `ok`, **webhookConfigured: false** |
| Live homepage headers | CSP present, HSTS preload, X-Frame-Options DENY, HTTP 200 |
| `npm audit` | Flaky TLS on agent host; prior run 0 vulns with system CA |

---

## Operator checklist (you)

See prior walkthrough. Minimum for next certification attempt:

```text
[ ] Supabase SQL: 016 → 017 → 018 → 019 → 020 → 021
[ ] Vercel: STRIPE_WEBHOOK_SECRET=whsec_...
[ ] Stripe Dashboard webhook → /api/functions/stripeWebhook
[ ] Vercel: VITE_SENTRY_DSN + SENTRY_DSN
[ ] Agent: deploy --prod (say "deploy now")
[ ] Smoke checkout + webhook delivery 200
```
