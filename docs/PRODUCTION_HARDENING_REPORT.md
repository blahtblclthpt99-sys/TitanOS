# TitanOS Production Hardening Report

**Date:** 2026-07-25  
**Branch:** `main` (hardening changes **local / uncommitted** unless deployed after this report)  
**Method:** Code inspection + live HTTP probes + automated Node tests. Items not live-verified are labeled **MANUAL**.

## Launch readiness score: **72 / 100** (Limited Beta / Closed Beta)

Raised from prior ~60–65 by: live Sentry server capture, health deep-check code (Supabase + Stripe ping), Stripe fail-closed + Idempotency-Key, rate limits on portal mutates, client Sentry user/release, migration 026 for driver trust fields, expanded structural tests.

Not public GA until: migrations 024–026 (and prior money/security) confirmed on prod DB, deploy of this hardening tree, Stripe Checkout settle E2E **MANUAL**, durable rate limiting, Playwright critical-path suite, source map upload to Sentry, `SENTRY_DEBUG_ROUTE` disabled.

---

## Phase results

### Phase 1 — Sentry
| Check | Status | Evidence |
|-------|--------|----------|
| Server API exceptions | **Verified (live)** | `GET /api/functions/sentryDebug` → `ok:true`, `sentryEnabled:true`, `environment:production` |
| Client errors / unhandledrejection | **Wired (code)** | `main.jsx` + `ErrorBoundary`; browser Issues confirm **MANUAL** |
| User context (opaque id) | **Wired (code)** | `setSentryUser` / `clearSentryUser` via AuthContext `applyUser` |
| Releases | **Partial** | API: `VERCEL_GIT_COMMIT_SHA`; client: Vite `define` (needs deploy) |
| Source maps | **Partial** | `sourcemap: "hidden"` — upload to Sentry **MANUAL** / not configured |
| `SENTRY_DEBUG_ROUTE` | **Open risk** | Still enabled on Production for verify — disable after confirm |

### Phase 2 — Health
| Check | Status | Evidence |
|-------|--------|----------|
| Liveness | **Verified (live)** | `GET /api/functions/health` → 200 |
| Supabase deep | **Verified (live)** | `?deep=1` → `supabase: ok` |
| Stripe deep + readiness | **Wired (local)** | Not yet on Production response body — **deploy required** |
| Failures visible | **Improved** | Deep dependency failure → 503 + `status: degraded` |

### Phase 3 — Stripe
| Check | Status | Evidence |
|-------|--------|----------|
| Config present | **Verified (live)** | Health: `stripeConfigured` + `webhookConfigured` true |
| Signature verify | **Code verified** | `constructEvent` in `stripeWebhook.js` |
| Idempotency table | **Code verified** | `stripe_webhook_events` |
| Fail closed w/o key | **Wired (local)** | 503 before payment insert — **deploy required** |
| Idempotency-Key | **Wired (local)** | Checkout session create — **deploy required** |
| Full Checkout settle E2E | **MANUAL** | Not run this sprint |
| Frontend does not mark paid | **Code verified** | Success toast only; settle via webhook |

### Phase 4 — Database
| Check | Status | Evidence |
|-------|--------|----------|
| Migrations 018–026 on disk | **Verified** | Files + hardening tests |
| Applied on production | **MANUAL** | Re-run `npm run test:db-security`; apply 024–026 in Supabase SQL |
| Driver trust forge | **Mitigated in SQL** | Migration **026** (apply required) |

### Phase 5 — Reliability
| Check | Status | Evidence |
|-------|--------|----------|
| `npm run typecheck` | **Verified** | Exit 0 |
| `npm run lint` | **Verified** | Exit 0 (`eslint . --quiet`) |
| `npm test` (incl. hardening) | **Verified** | Exit 0 |
| Sentry debug route | **Verified (live)** | 200 |

### Phase 6 — Performance
| Check | Status | Evidence |
|-------|--------|----------|
| Lazy routes + manualChunks | **Code verified** | App/TabStack + vite.config |
| Hidden source maps | **Wired** | Build config only; no UX change |
| OptimizedImage breadth | **Gap** | Limited adoption — medium/low |

### Phase 7 — Automated testing
| Check | Status | Evidence |
|-------|--------|----------|
| Node suites | **Verified** | fees/hire/payments/driver/money/tax/auth/hardening |
| Critical workflow structural | **Verified** | Auth pages, Driver Hub, Dashboard, Estimates, Payments, Profile |
| Playwright browser E2E | **Missing** | High remaining risk — no parallel suite added |

### Phase 8 — Security
| Check | Status | Evidence |
|-------|--------|----------|
| Security headers | **Verified** | vercel.json CSP/HSTS |
| Rate limits (portal/register/payments) | **Improved (local)** | Portal + directions — deploy required |
| In-memory limiter on serverless | **Remaining risk** | Weak under multi-instance |
| Secrets not in git | **Verified** | DSN only in Vercel env |

### Phase 9 — Operations
| Check | Status | Evidence |
|-------|--------|----------|
| GitHub `main` → Vercel | **Verified (prior)** | Source of truth for Production |
| Rollback | **Documented** | `docs/DEPLOYMENT_CHECKLIST.md` §7 Promote previous |
| Env vars | **Documented** | Checklist + Sentry debug note |
| Backup/PITR | **MANUAL** | Runbook exists; confirm PITR/`LAST_CONFIRMED` separately |

---

## 1. Critical issues
1. **Confirm migrations 018/019/021/024/025/026 applied on production Supabase** — on-disk ≠ applied.
2. **Disable `SENTRY_DEBUG_ROUTE` after verification** — intentional test endpoint still live.
3. **Deploy this hardening tree** — Production still serves pre-hardening health (no `readiness`/`stripe` deep fields observed live).

## 2. High-priority issues
1. No Playwright/critical-path browser E2E (auth → estimate → pay).
2. In-memory rate limits ineffective across Vercel instances.
3. Stripe Checkout → webhook settle not live-verified this sprint.
4. Sentry source map upload not configured.

## 3. Medium-priority improvements
1. Portal pay path fee/payment-row parity with `createPaymentLink`.
2. Client Sentry event confirm in dashboard (**MANUAL**).
3. Expand `verify-db-security` for 023/026 trust fields.
4. Optional strict health: 503 when `moneyPath=incomplete` for k8s-style probes.

## 4. Low-priority improvements
1. Broader `OptimizedImage` adoption.
2. Nested ErrorBoundaries on Payments/AI.
3. Tighten CSP `connect-src` if Stripe/OpenAI never called from browser.

## 5. Files modified (this sprint — uncommitted)
- `src/lib/sentry.js`, `src/lib/AuthContext.jsx`
- `api/functions/health.js`, `createPaymentLink.js`, `portalAcceptEstimate.js`, `portalLeaveReview.js`, `directionsOptimize.js`
- `api/register.js`
- `vite.config.js`, `package.json`
- `supabase/migrations/026_protect_driver_trust_fields.sql`
- `scripts/production-hardening.test.mjs`
- `docs/PRODUCTION_HARDENING_REPORT.md`, `docs/DEPLOYMENT_CHECKLIST.md`

## 6. Tests executed
| Test | Result |
|------|--------|
| Live `GET /api/functions/health?deep=1` | Pass (supabase ok; readiness fields not yet deployed) |
| Live `GET /api/functions/sentryDebug` | Pass (exception sent; confirm in Sentry UI **MANUAL**) |
| `node --test scripts/production-hardening.test.mjs` | Pass |
| `npm run test:payments` | Pass (13) |
| `npm test` | Pass |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| Stripe Checkout E2E / Playwright / db-security against prod | **Not run / MANUAL** |

## 7. Remaining production risks
- Unapplied SQL migrations on prod
- Hardening not yet deployed
- Multi-instance rate-limit bypass
- No browser E2E for money/auth
- Unuploaded source maps
- Open Sentry debug route

## 8. Updated launch readiness: **72/100**
**Recommendation:** Remain **Limited / Closed Beta**. Do not market as public production-ready until Critical #1–3 and High #1–3 are closed.

### Immediate next actions (ops)
1. Apply Supabase migrations through **026**.
2. Commit + deploy this tree to Production (or ask agent to ship).
3. Confirm Sentry Issue from `sentryDebug`, then set `SENTRY_DEBUG_ROUTE=0`.
4. Run one Stripe test-mode Checkout + webhook settle (**MANUAL**).
5. Run `npm run test:db-security` against prod credentials.
