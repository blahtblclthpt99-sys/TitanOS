# TitanOS Release Candidate 1 (RC1) — Final Report

**Audit date:** 2026-07-24 (re-verified)  
**Live site:** https://titanos-web.vercel.app  
**Scope:** Stability / security / production readiness only — **no new features**.  
**Rule:** Claims below are evidence-backed; anything not executed is marked **unverified**.

---

## Overall recommendation

### Ready for: **Closed Beta**

| Track | Verdict | Evidence |
|-------|---------|----------|
| Internal Testing | **Yes** | Unit gates green; health OK; DB money probes PASS |
| Closed Beta | **Yes** | Core product usable; Stripe configured; Driver Hub table live |
| Open Beta | **Not yet** | Production still on older deploy (register CORS `*`); Resend/Sentry missing; Checkout settle **unverified** |
| Public Launch | **No** | Same + email-confirm not enforced by default; Labs partner gaps |

**Composite launch score: 6.7 / 10**

---

## Evidence snapshot (this re-audit)

| Check | Result |
|-------|--------|
| `GET /api/functions/health?deep=1` | HTTP 200 · `stripeConfigured: true` · `webhookConfigured: true` · `supabase: ok` |
| `verify-db-security.mjs` | **PASS** (019 payment + 021 invoice/privilege) |
| Driver `id_verified` client probe | **PASS** (`finalIdVerified: false`) |
| `driver_profiles` / `stripe_webhook_events` / `fee_rules` | **exist** |
| Live unsigned webhook POST | **400** `Missing Stripe-Signature` |
| Live public pages `/` `/login` `/register` `/pricing` `/portal` | **200** |
| Live `OPTIONS /api/register` `Access-Control-Allow-Origin` | **`*`** ← production **has not** received local CORS fix yet |
| Vercel Production env | Supabase + Stripe only (no Resend / Sentry / OTP pepper / `REGISTER_REQUIRE_EMAIL_CONFIRM`) |
| Git | `HEAD == origin/main` @ `025eb54` but **large uncommitted local tree** |
| `npm typecheck` / `lint` / `test` | **Pass** (local) |
| Stripe Checkout → webhook settle | **Not executed** |
| Authenticated UI E2E (login→dashboard→pay) | **Not executed** |
| axe / Lighthouse | **Not run** |

---

## Critical Issues

| ID | Issue | Evidence | Status |
|----|-------|----------|--------|
| C1 | Money status forge via client | Behavioral probe blocks payment `succeeded` + invoice `paid` | **Resolved (DB)** |
| C2 | Profile privilege escalation | Probe: role stays `user` | **Resolved (DB)** |
| C3 | Open register abuse (CORS `*` + no rate limit) on **live** | Live OPTIONS still `Access-Control-Allow-Origin: *` | **Fixed in local tree; NOT on Production until redeploy** |
| C4 | Auto-confirm register sessions | Local code allows `REGISTER_REQUIRE_EMAIL_CONFIRM`; default still auto-confirm | **Mitigated in code; Public Launch must set env** |

---

## High Issues

| ID | Issue | Evidence | Status |
|----|-------|----------|--------|
| H1 | Production lag vs hardened local RC fixes | Live register CORS `*`; CSP Open-Meteo only in local `vercel.json` | **Open — redeploy required** |
| H2 | Resend / portal OTP | Env list has no `RESEND_*` | **Open (ops)** |
| H3 | `PORTAL_OTP_PEPPER` unset | Not in Vercel env ls | **Open (ops)** |
| H4 | Sentry unset | Not in Vercel env ls | **Open (ops)** |
| H5 | Checkout→webhook settle | Not run | **Unverified** |
| H6 | Git/Production parity | Dirty tree; commit `025eb54` | **Open (process)** |
| H7 | Driver `id_verified` forge | Probe PASS; client upsert omits field; migration 023 in repo | **Resolved in DB behavior** (trigger likely applied) |

---

## Medium Issues

| ID | Issue | Status |
|----|-------|--------|
| M1 | Reset password lacked min-length client check | **Fixed** (`ResetPassword.jsx`) |
| M2 | Payments empty/loading UX | **Fixed** (EmptyState + PageLoader) |
| M3 | Payments checkout `aria-label` | **Fixed** (local; needs redeploy) |
| M4 | Driver Hub tabpanel a11y | **Fixed** (local; needs redeploy) |
| M5 | API `console.error` vs `safeLog` inconsistency | **Open** |
| M6 | Soft in-memory rate limits | **Open** |
| M7 | Landing placeholder testimonials | Disclosed; residual trust risk |
| M8 | Admin routes UI-only gate | **Open** |
| M9 | Payment orphan pending if Stripe fails post-insert | **Open** |

---

## Low Issues

| ID | Issue | Status |
|----|-------|--------|
| L1 | No Playwright suite | Open |
| L2 | No Lighthouse / axe run this audit | Unverified |
| L3 | Upload bucket privacy (020) | Not re-probed |
| L4 | Filter chip scroll UX on mobile | Open |

---

## Primary workflows

| Workflow | Verdict | Notes |
|----------|---------|-------|
| Registration | **Conditional** | Live page 200; abuse controls **not live** until redeploy; full signup E2E **unverified** |
| Login | **Unverified E2E** | Page 200; auth code present |
| Profile | **Likely OK** | Privilege triggers PASS |
| Dashboard | **Unverified E2E** | Code + weather location path in tree |
| Driver Hub | **OK (DB)** | `driver_profiles` exists; publish path in code; UI E2E unverified |
| Marketplace | **Unverified E2E** | |
| Search | **Partial / unverified** | |
| Payments | **Config OK / settle unverified** | Health + unsigned webhook reject; no paid event |
| Notifications | **Honesty OK** | Samples removed earlier; emitters incomplete |
| Settings | **Unverified E2E** | |

---

## APIs / DB / Env / Deploy

- **APIs:** Auth matrix previously mapped; this audit live-checked `health`, unsigned `stripeWebhook`, `register` OPTIONS, public HTML routes only.  
- **DB:** 018/019/021/022 confirmed; `id_verified` client write blocked.  
- **Env (Production):** Supabase + Stripe present; Resend/Sentry/OTP pepper/`REGISTER_REQUIRE_EMAIL_CONFIRM` absent.  
- **Deploy:** Vercel project `titanos-web`; Production **does not yet reflect** local RC hardening (CORS evidence).

---

## Scores (1–10)

| Dimension | Score | Basis |
|-----------|------:|-------|
| Stability | 7 | Gates green; prod lag |
| Security | 7 | DB strong; live register CORS weak until redeploy |
| Payments | 7 | Config OK; settle unverified |
| Driver Hub | 8 | Table + publish path |
| UX (empty/loading/errors) | 7 | Payments empty fixed locally |
| Accessibility | 6 | Incremental; no axe |
| Performance | 7 | Build OK; no Lighthouse |
| Ops / observability | 5 | No Sentry/Resend |
| Production parity | 4 | Live ≠ local RC tree |
| **Composite** | **6.7** | Closed Beta |

---

## Fixes in this RC pass (local tree)

1. Register: CORS allowlist + rate limit + optional email confirm (prior)  
2. CSP Open-Meteo (prior)  
3. Driver `id_verified` client strip + migration 023 (prior)  
4. Reset password min length  
5. Payments EmptyState + PageLoader  
6. a11y: Payments checkout label; Driver Hub tabpanels (prior)

---

## Blockers to Open Beta / Public Launch

1. **Redeploy** hardened tree so live register CORS / CSP / a11y match local  
2. Add **Resend** + **PORTAL_OTP_PEPPER** (+ Sentry)  
3. Optionally set **`REGISTER_REQUIRE_EMAIL_CONFIRM=true`** when email works  
4. Run **one Stripe test Checkout** and confirm webhook settles  
5. **Commit/push** so Production tracks Git  

Until then: **Closed Beta / Internal Testing only.**
