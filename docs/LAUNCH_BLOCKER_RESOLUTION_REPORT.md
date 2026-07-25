# Launch Blocker Resolution Sprint — Report

**Date:** 2026-07-24  
**Live:** https://titanos-web.vercel.app  
**Method:** Behavioral DB probes, Vercel env audit, code hardening, unit gates. Supabase SQL Editor required login — **migration 021 could not be applied from this agent session**.

---

## 1. Blockers confirmed

| Blocker | Evidence |
|---------|----------|
| **021 not applied** | Live probe: client set `invoices.status=paid` and `profiles.role=admin` / `is_pro` / `plan_tier` |
| **019 applied** | Live probe: client `payments.status=succeeded` blocked by RLS (`new row violates row-level security policy`) |
| **018 applied** | `stripe_webhook_events` table exists |
| **017 present** | `fee_rules` / `fee_categories` exist |
| Stripe webhook secret | On Vercel; live health `webhookConfigured: true` |
| Resend / Sentry / PORTAL_OTP_PEPPER | Missing on Vercel |
| Git ↔ Production parity | `main` == `origin/main` at `025eb54`, but large **uncommitted** hardening tree |
| Live Checkout→settle E2E | Not executed (no card session this sprint) |

---

## 2. Resolved in this sprint (verified)

| Item | Verification |
|------|----------------|
| DB security **probe script** | `npm run test:db-security` → `scripts/verify-db-security.mjs` (reproducible) |
| App defense: entity Invoice/Payment paid/succeeded | `src/api/entityAdapter.js` + `test:auth` |
| Portal pay origin allowlist | `portalPayInvoice.js` uses `allowedOrigins` / `resolveAppOrigin` |
| CORS configured-origin loophole | `cors.js` no longer accepts arbitrary HTTPS outside allowlist |
| Payment / webhook / auth unit tests expanded | `npm test` — all green (fees, hire, payments, stripe policy, driver, money, auth) |
| typecheck / lint / build | Pass (this sprint) |
| Ops docs: apply 021, Sentry, Resend | `ops/APPLY_021.md`, `ops/SENTRY_AND_RESEND.md` |
| Product messaging honesty | Landing Labs/core wording; Driver Hub already has StatHint + honesty banners |
| `.env.example` | Documents `PORTAL_OTP_PEPPER`, `APP_ORIGIN` |

---

## 3. Requires external / manual configuration

| Action | Owner | Why agent cannot finish |
|--------|-------|-------------------------|
| **Run `021_privilege_money_integrity.sql` in Supabase SQL Editor** | You | Dashboard login required; no `SUPABASE_ACCESS_TOKEN` / DB password in env |
| Add `RESEND_API_KEY`, `RESEND_FROM`, `PORTAL_OTP_PEPPER` on Vercel | You | Secrets not inventable |
| Add `SENTRY_DSN` / `VITE_SENTRY_DSN` on Vercel | You | Optional but recommended |
| Commit + push hardened tree → Vercel Git deploy | You | User rule: no commit unless asked |
| Stripe test Checkout → webhook settle smoke | You / QA | Needs Stripe Dashboard + test card |

After applying 021:

```bash
node scripts/verify-db-security.mjs
# expect conclusion.overall === "PASS"
```

---

## 4. Still open (and why)

| Issue | Severity | Why open |
|-------|----------|----------|
| Migration **021** on production | **Critical** | Confirmed missing by live probe; SQL not applied (auth wall) |
| Checkout settle E2E | **High** | Not run this sprint |
| Resend / portal OTP email | **High** | Env missing; code fail-closes correctly |
| Sentry | **Medium** | Env missing; code no-ops |
| Git commit of hardening | **High** (process) | Not requested to commit |
| Upload bucket private (020) | **Medium** | Not re-probed this sprint |
| Playwright E2E suite | **Medium** | Project uses `node:test`; expanded that instead of adding Playwright |

---

## 5. Remaining launch risk

**Critical** — until 021 is applied and re-verified with `verify-db-security.mjs`.

App-layer guards reduce SPA risk but **do not** stop raw PostgREST privilege / invoice paid updates.

---

## 6. Updated Go / No-Go

### Ready for Limited Beta (unchanged tier) — with narrower Critical path

**Evidence for progress:**
- 019 + 018 confirmed live  
- Stripe key + webhook configured; unsigned webhook rejected  
- Unit suite expanded and green  
- Payment origin hardening shipped in tree  

**Still Not Ready for unrestricted public money launch** until:
1. `021` applied + probe PASS  
2. One successful Checkout→webhook settle  
3. Hardened code on Production via Git (or confirmed CLI deploy of this tree)  

---

## Driver Hub / Product (P5–P6)

- Shift panel: toggles, miles, StatHints, honesty banner — present in code  
- Directory: empty + honesty (no fake drivers)  
- Landing: marketplace claim → Driver Hub; “Full product” softened to core + Labs labeled  

---

## How to close Critical today (5 minutes)

1. Open https://supabase.com/dashboard/project/xcfjpxcmokdfwkarwomy/sql/new  
2. Paste `supabase/migrations/021_privilege_money_integrity.sql` → Run  
3. `node scripts/verify-db-security.mjs` → expect PASS  
4. Tell the agent — we will re-audit and update Go/No-Go
