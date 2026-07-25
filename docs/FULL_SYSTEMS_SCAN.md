# TitanOS — Full Systems Scan

**Date:** 2026-07-21  
**Scope:** Entire repo (static analysis) + live health + quality gates  
**Standard:** No file area left unscanned; findings ranked by severity  

---

## Executive summary

| Gate | Result |
|------|--------|
| Typecheck | Pass (`tsconfig` JS gate) |
| Lint | Pass |
| Unit tests (fees + hire + payments) | Pass (28) |
| npm audit (prod) | **0 vulnerabilities** |
| Live health | API/Supabase OK · Stripe key OK · **webhook secret MISSING** |
| Git working tree | Large dirty tree vs `origin/main` |

**Overall system health: 64/100** — code hardened in-tree; production money/RLS depends on ops (webhook + migrations + deploy).

---

## Coverage map

| Area | Approx. files | Scanned |
|------|---------------|---------|
| `src/` (JS/JSX/CSS) | ~300+ | Auth, payments, hire, UI, layouts, APIs |
| `api/` | ~31 handlers + `_lib` | All routes: auth, RL, Sentry, methods |
| `supabase/migrations/` | 21 SQL (001–021) | Schema + RLS + triggers |
| `scripts/` | ~22 | Tests, drills, Android, checks |
| `shared/` | fee engine | Fee math |
| `android/` | app config | versionCode 16 / 1.5.1, minify off |
| `docs/` | 70+ MD (project + reports) | Readiness / Stripe / deploy |
| Root config | package/vercel/vite/ts/ci | Engines, CSP, CI |
| Live prod | health + Vercel env names | Verified this session |

Project-wide (excl. node_modules/dist/build): ~**800** `.js`, **303** `.jsx`, **21** `.sql`, plus JSON/MD/TS.

---

## Critical (fix immediately)

| # | Finding | Evidence |
|---|---------|----------|
| C1 | **Stripe webhook secret not on Vercel** | Health `webhookConfigured: false`; env list has only `STRIPE_SECRET_KEY`; webhook POST → 503 |
| C2 | **Migrations 016–021 not proven on all policies/triggers** | Tables for 017/018 exist; privilege/payment/hire lockdown needs 016/019/021 applied |
| C3 | **Hardened tree may not be on production** | Large dirty/untracked set vs deployed `main` |
| C4 | **Without 021, profile privilege escalation still possible via direct API** | Trigger freezes role/plan; client allowlist alone is bypassable |

---

## High

| # | Finding | Evidence |
|---|---------|----------|
| H1 | Soft per-instance rate limits | `api/_lib/rateLimit.js` |
| H2 | ~12 mutating APIs lack rate limits | portalPay, OCR, aiExecuteAction, followUp, referrals, calculateFee, … |
| H3 | OTP logged in cleartext if Resend unset | `portalRequestOtp.js` |
| H4 | 1-year signed upload URLs | `integrations.js` |
| H5 | Checkout via raw Stripe REST (no SDK API version pin) | `createPaymentLink.js`, `portalPayInvoice.js` |
| H6 | `aiExecuteAction` service-role writes + no RL | Abuse if JWT stolen |
| H7 | Upload privacy depends on migration 020 | Bucket public until applied |
| H8 | Sentry DSNs unset on Vercel | Monitoring no-op |
| H9 | `booking_requests` authenticated `WITH CHECK (true)` | `004` never tightened |

---

## Medium

| # | Finding |
|---|---------|
| M1 | Hire jobs board world-readable (`USING true`) — intentional but PII risk |
| M2 | CSP allows browser connect to OpenAI/Resend unused by client |
| M3 | CI skips `test:payments` |
| M4 | Dual fee preview (`platformFee`/`plan`) vs server Fee Engine |
| M5 | `FREE_DURING_BETA` unlocks all features |
| M6 | Android `minifyEnabled false` |
| M7 | Portal routes inconsistent CORS |
| M8 | A11y: empty alts, unlabeled AI input, custom menus without focus traps |
| M9 | UX: honesty banners good; Landing placeholder quotes; no onboarding |
| M10 | Dashboard/AI multi-list fan-out; PieChart ~384 KB island |
| M11 | Health exposes config booleans |
| M12 | Beta anon INSERT spam surface |
| M13 | Duplicate fee modules (`shared` + `src` re-export) |

---

## Low

- Chart `dangerouslySetInnerHTML` (theme CSS only)  
- Docs sprawl / conflicting readiness scores  
- Typecheck `checkJs: false`  
- No Stripe Connect payouts  
- In-memory rate-limit map eviction  

---

## API matrix (all handlers)

| Handler | Auth | Rate limit | Sentry |
|---------|------|------------|--------|
| adminFees | admin JWT | Y | Y |
| aiExecuteAction | JWT | N | N |
| attachReferral | JWT | N | N |
| calculateFee | JWT | N | N |
| createNotification | JWT | Y | Y |
| createPaymentLink | JWT | Y | Y |
| directionsOptimize | JWT | N | N |
| health | none | N | N |
| markReferralPaying | admin/hook | N | N |
| portalAcceptEstimate | portal | N | N |
| portalGetData | portal | N | N |
| portalLeaveReview | portal | N | N |
| portalPayInvoice | portal | N | N |
| portalRequestOtp | none | Y | Y |
| portalVerifyOtp | OTP | Y | Y |
| receiptVisionOcr | JWT | N | N |
| seedMarketplace | admin | Y | Y |
| sendEmail | JWT | Y | Y |
| sendFollowUp | JWT | N | N |
| stripeWebhook | signature | Y | Y |
| titanAI | JWT | Y | Y |
| register | public | N | N |
| signup-emails | POST public / GET export key | POST Y | N |

---

## Migrations 001–021 (one line each)

001 Core schema+RLS · 002 Hire/community/messages · 003 Comms/files · 004 Booking/contracts · 005 Payments/companies · 006 Fee columns · 007 Plan tiers · 008 Ops inventory · 009 Loyalty/escrow · 010 Insurance/portal · 011 Job summaries · 012 Contract token harden · 013 Equipment year · 014 Pro profile · 015 Signup emails · **016 Hire apps RLS** · **017 Fee engine** · **018 Webhook idempotency** · **019 Payment/hire/notify lockdown** · **020 Private uploads+indexes** · **021 Privilege+invoice paid triggers**

---

## Positive findings

- Webhook fail-closed without secret/signature  
- Server-side fees + invoice ownership on checkout  
- Client cannot mark payment/invoice paid (in current code)  
- CORS allowlist; CSP/HSTS/XFO on Vercel  
- Feature honesty banners on many incomplete surfaces  
- CI: typecheck + lint + fee/hire tests + build  
- npm audit clean  
- Android AAB 1.5.1 / versionCode 16 built  

---

## Live production snapshot (this scan)

```json
{
  "stripeConfigured": true,
  "webhookConfigured": false,
  "supabase": "ok"
}
```

Vercel env present: Supabase + `STRIPE_SECRET_KEY` only for Stripe. **No** `STRIPE_WEBHOOK_SECRET`, **no** Sentry.

---

## Prioritized action plan

### P0 (this week)
1. Add `STRIPE_WEBHOOK_SECRET` + redeploy → retest health  
2. Apply/verify SQL **016→021** on Supabase (policies + triggers)  
3. Commit + prod-deploy hardened tree  

### P1 (next sprint)
4. Rate-limit remaining mutators; remove OTP console.log  
5. Stripe SDK for Checkout create (API version pin)  
6. Set Sentry DSNs; confirm event  
7. Fix `booking_requests` WITH CHECK ownership  
8. Add `test:payments` to CI  

### P2 (quality)
9. Unify fee preview with `calculateFee` API  
10. Slim AI/Dashboard queries; lighter charts  
11. A11y pass + onboarding  
12. Android minify + ProGuard  

---

## Scores (this scan)

| Dimension | Score |
|-----------|------:|
| Security (code) | 68 |
| Security (live ops) | 45 |
| Reliability | 58 |
| Performance | 72 |
| UX / honesty | 70 |
| Maintainability | 62 |
| **Overall** | **64** |

**Decision: NOT production-certified until P0 complete.** Code is substantially safer than early TitanOS; settlement and DB lockdown on live remain the blockers.
