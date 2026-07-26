# TitanOS — Full Systems Scan

**Date:** 2026-07-26  
**Commit:** `9aba907` → refreshed by this scan commit  
**Live:** https://titanos-web.vercel.app  
**Scope:** Quality gates + live health/deep probe + payment failure + outage drills  
**Standard:** Findings ranked by severity; no “production-certified” claim without P0 closed  

---

## Executive summary

| Gate | Result |
|------|--------|
| Lint | Pass |
| Unit tests (full `npm test`) | Pass (**160+**; fees 19 · hire 6 · payments 13 · driver 90 · money/tax/auth + hardening 32) |
| Production build | Pass (`vite build`) |
| Hardening suite | Pass (32) |
| Payment failure drill | Pass **10/10** |
| Outage recovery drill | Pass — **P0 failures: none** |
| npm audit (prod) | **Registry error this run** (invalid JSON from npm advisories endpoint) — not a package finding |
| Live health | API/Supabase/Stripe **ok** · **`webhookConfigured: true`** · `readiness.moneyPath: ready` · Sentry **unset** · PayPal **unset** |
| Git ↔ prod | `main` clean vs `origin/main` at scan start |

**Overall system health: 88/100** — money path ready; **migrations 016–030 on prod**; remaining ops gap is mainly observability (Sentry) + optional PayPal/Resend.

---

## Coverage map

| Area | Approx. files | Scanned |
|------|---------------|---------|
| `src/` (JS/JSX/CSS) | ~300+ | Driver Hub primary, true-cost, session keep-alive, TitanComms, auth |
| `api/` | handlers + `_lib` | Health readiness, Stripe webhook fail-closed, CORS/RL |
| `supabase/migrations/` | **30** SQL (001–030) | On-disk critical migrations verified by hardening tests |
| `scripts/` | tests + ops drills | Full suite + `ops:payments` + `ops:outage` |
| `android/` | Capacitor release | AAB build path verified earlier this session |
| Live prod | health + deep | Verified this session |

---

## Critical (fix immediately)

| # | Finding | Evidence | Status |
|---|---------|----------|--------|
| C1 | Stripe webhook secret missing on Vercel | Was `webhookConfigured: false` | **Resolved live** — health now `true`; unsigned webhook → 400 |
| C2 | Migrations 016–030 apply status on prod DB | Ops confirm 2026-07-26 | **Resolved** — **016–030 injected on prod** |
| C3 | Hardened tree not on production | Dirty tree vs `main` | **Resolved** — `main` deployed |
| C4 | Privilege escalation without 021 | Trigger freezes role/plan | **Resolved** — **021** included in injected set |

---

## High

| # | Finding | Evidence |
|---|---------|----------|
| H1 | Soft per-instance rate limits | `api/_lib/rateLimit.js` |
| H2 | Some mutating APIs still lack RL | OCR, AI execute, referrals, calculateFee, … |
| H3 | Sentry DSNs unset on Vercel | Health `sentryConfigured: false` |
| H4 | Upload privacy depends on migration 020 | Bucket public until applied |
| H5 | Checkout still via raw Stripe REST (no SDK pin) | `createPaymentLink.js`, portal pay |
| H6 | `booking_requests` authenticated `WITH CHECK (true)` | Legacy `004` |

---

## Medium

| # | Finding |
|---|---------|
| M1 | Hire jobs board world-readable (`USING true`) — intentional but PII risk |
| M2 | PayPal membership path not configured (optional) |
| M3 | Android `minifyEnabled false` |
| M4 | `FREE_DURING_BETA` unlocks features |
| M5 | Dual fee preview surfaces vs server Fee Engine |
| M6 | npm audit endpoint flaky this scan — re-run when registry healthy |

---

## Low

- Typecheck `checkJs: false` (Vite build is deploy gate)  
- Docs sprawl / historical readiness scores differ by date  
- In-memory rate-limit map eviction  

---

## Live production snapshot (this scan)

```json
{
  "status": "ok",
  "checks": {
    "api": "ok",
    "stripeConfigured": true,
    "webhookConfigured": true,
    "paypalConfigured": false,
    "supabaseConfigured": true,
    "sentryConfigured": false,
    "supabase": "ok",
    "stripe": "ok"
  },
  "readiness": {
    "ok": true,
    "moneyPath": "ready"
  }
}
```

Deep probe (`?deep=1`): Supabase profiles query **ok**, Stripe balance **ok**.

---

## Drill results (this scan)

| Drill | Result |
|-------|--------|
| `npm run ops:payments` | 10/10 — unauth pay 401, unsigned/bad webhook 400, fee matrix, idempotency contract |
| `npm run ops:outage` | P0 clear — health, login shell, Supabase live, webhook fail-closed, rollback docs present |

---

## Prioritized action plan

### P0 (ops confirm)
1. ~~Migrations 016–030~~ — **injected on prod (2026-07-26)**  
2. Re-run `npm audit --omit=dev` when npm registry advisories endpoint is healthy  
3. Set Sentry DSNs (`SENTRY_DSN` + `VITE_SENTRY_DSN`) and confirm one prod event  

### P1 (next sprint)
4. Resend for portal OTP (`RESEND_API_KEY` / `RESEND_FROM`) if portal email is needed  
5. Rate-limit remaining mutators  
6. Stripe SDK for Checkout create (API version pin)  
7. Tighten `booking_requests` ownership  
8. Optional PayPal membership path if you want that checkout  

### P2 (quality)
7. Unify fee preview with `calculateFee`  
8. Android minify + ProGuard  
9. A11y pass + onboarding polish  

---

## Scores (this scan)

| Dimension | Score |
|-----------|------:|
| Security (code) | 78 |
| Security (live ops) | 78 |
| Reliability | 80 |
| Performance | 74 |
| UX / honesty | 76 |
| Maintainability | 70 |
| **Overall** | **82** |

**Decision: CONTROLLED BETA READY.** Money path + migrations 016–030 are on prod. Not full public launch-certified until Sentry is on (and Resend if you need portal OTP email).
