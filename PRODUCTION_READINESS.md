# TitanOS Production Readiness Review

**Date:** 2026-07-19  
**Target:** https://titanos-web.vercel.app  
**Scope:** Load, backup/restore, payment failure, outage recovery — not just code inspection.

## Executive verdict

| Area | Result | Launch impact |
|------|--------|---------------|
| Load (≤500 concurrent) | **PASS** — 0% errors, p95 ≤1.1s | Ready for early traffic |
| Load spike (800–1500 concurrent) | **FAIL latency** — 0% errors, p95 8–10s | Not ready for viral/launch spike without CDN/edge tuning + higher limits |
| Payment failure handling | **PASS** (API gates) | Webhook still **503** in prod → Stripe secrets/webhook not live |
| Backup inventory | **PASS** (tables/auth/storage reachable) | Full PITR restore drill still **manual** |
| Outage recovery (P0) | **PASS** | Health probe needs deploy; Stripe webhook config missing |

**Overall:** Safe for **controlled beta traffic**. **Not** ready for a high-traffic public launch until Stripe webhook is live, a real restore drill is completed, and spike latency is addressed.

---

## 1. Load testing (executed)

Harness: `npm run ops:load` → `scripts/load-test.mjs`  
Mixed targets: public pages + unauth API deny paths (realistic mix without forging logins).

### Storm profile (hundreds of users) — PASS

| Phase | Concurrent | Duration | Requests | RPS | Error % | p50 | p95 | p99 |
|-------|------------|----------|----------|-----|---------|-----|-----|-----|
| 1 | 50 | 10s | 5,532 | 553 | 0 | 70ms | 176ms | 460ms |
| 2 | 150 | 15s | 10,221 | 681 | 0 | 190ms | 308ms | 1.3s |
| 3 | 300 | 20s | 14,261 | 713 | 0 | 374ms | 580ms | 2.7s |
| 4 | 500 | 15s | 10,786 | 719 | 0 | 610ms | **1.1s** | 3.5s |

**~40k requests**, zero application errors under 500 concurrent.

### Spike profile (toward thousands) — FAIL (latency)

| Phase | Concurrent | RPS | Error % | p95 |
|-------|------------|-----|---------|-----|
| 1 | 200 | 354 | 0 | 2.7s |
| 2 | 800 | 259 | 0 | **8.9s** |
| 3 | 1500 | 303 | 0 | **10.6s** |

Pass criteria: error rate &lt;5% **and** p95 &lt;5s. Spike kept serving (no hard crash) but **user-visible lag** at ~800+.

### Recommendations
1. Put Cloudflare or Vercel Firewall rate limits in front of `/api/*`.
2. Edge-cache public HTML/assets more aggressively (already immutable on `/assets/*`).
3. Add regional Supabase + measure auth/DB under load separately (this run stressed origin + serverless cold paths).
4. Before a marketing launch, re-run `npm run ops:load:spike` against a **Preview** clone, not only production.

---

## 2. Payment failure scenarios (executed)

Harness: `npm run ops:payments` → **10/10 PASS**

| Scenario | Result |
|----------|--------|
| Unauthenticated `createPaymentLink` | 401 |
| Portal pay with bad session | 401 |
| Webhook without signature | **503** (refuses forge — good; also means webhook not configured) |
| Webhook bad signature | **503** |
| Fee matrix (free/premium/business + edges) | Exact match |
| Stripe test-card recovery matrix documented | 7 cards in `ops/results/stripe-test-cards.json` |
| Idempotent status (succeeded not overwritten) | Pass |
| Metadata contract (`invoice_id` + `payment_id` + fail events) | Pass (code fixed this session) |
| Payments table readable | Pass |

### Critical finding — money path incomplete in production
Production `stripeWebhook` returns **503** (`Stripe webhook not configured`). That means:
- Successful Checkouts **will not** auto-mark invoices/payments paid until `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` are set and raw-body verification works.
- Stripe will retry; events queue — but the app stays wrong until fixed.

### Code fixes shipped in this pass
1. `createPaymentLink` now inserts payment **first**, then puts `metadata[invoice_id]` + `metadata[payment_id]` on Checkout (previously webhook could never settle by payment id; invoice only via unused `client_reference_id`).
2. Webhook settles via metadata **or** `client_reference_id` **or** `external_id` session lookup.
3. Handles `checkout.session.expired`, `async_payment_failed`, `payment_intent.payment_failed`, `charge.failed`.
4. Stripe API failures mark payment `failed` instead of leaving orphan pending rows without note.

### Manual Stripe test mode (still required)
Use cards in `ops/results/stripe-test-cards.json` against a configured Checkout session:
- Decline / insufficient funds / expired → invoice stays unpaid; payment `failed`/`canceled`
- `4242…` success → webhook marks invoice `paid` + payment `succeeded`
- Replay duplicate webhook → stays idempotent

---

## 3. Backup & restore (executed + manual remaining)

Harness: `npm run ops:backup`

### Automated inventory (PASS)
| Table | Rows (live) |
|-------|-------------|
| profiles | 4 |
| customers | 2 |
| jobs | 2 |
| invoices | 1 |
| estimates | 1 |
| payments | 3 |
| contracts | 0 |
| portal_sessions | 0 |
| marketplace_listings | 0 |
| community_posts | 2 |

- Auth Admin API: reachable  
- Storage: `titanos-uploads` (**public=true** — launch risk)  
- Logical sample export written under `ops/backups/`  
- Runbook: `ops/backups/RESTORE_RUNBOOK.md`

### Still required before public launch (manual)
1. Confirm Supabase daily backups / PITR in Dashboard; record timestamp.  
2. Restore into a **scratch** Supabase project; point a Vercel Preview at it; run `auth:check` + `ops:payments`.  
3. Weekly cold copy of storage objects until private/versioned bucket.  
4. Measure RTO/RPO against targets: **RPO ≤60m, RTO ≤30m**.

---

## 4. Unexpected outage recovery (executed)

Harness: `npm run ops:outage` — **all P0 PASS**

| Check | Severity | Result |
|-------|----------|--------|
| Landing origin up | P0 | 200 @ ~311ms |
| Login shell static resilience | P0 | 200 |
| Supabase fail-closed on bad host | P0 | Pass |
| Supabase live probe | P0 | ~167ms |
| Webhook never 200 when misconfigured | P0 | 503 |
| Health endpoint | P1 | **404 until deploy** of `api/functions/health.js` |
| 40× unauth payment storm | P1 | all 401 (no 5xx) |
| Client timeout budget | P1 | abort works |
| Rollback docs present | P1 | Pass |

### Incident playbook (validated as documented)
1. Identify blast radius: Vercel vs Supabase vs Stripe  
2. Disable Checkout / show maintenance if money path unsafe  
3. Promote last good Vercel deployment  
4. PITR → scratch project if DB integrity suspect  
5. Replay Stripe events after webhook healthy  
6. Post-mortem within 48h  

---

## 5. How to re-run

```bash
npm run ops:payments
npm run ops:backup
npm run ops:outage
npm run ops:load          # storm (hundreds)
npm run ops:load:spike    # thousands — expect latency fail until scaled
npm run ops:readiness     # payments + backup + outage + storm
```

---

## 6. Launch gate checklist

- [x] Survive 500 concurrent with p95 &lt;5s and ~0% errors  
- [ ] Survive 1000+ concurrent with p95 &lt;5s (currently fails)  
- [x] Payment APIs reject unauth / forged webhooks  
- [ ] `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` live; webhook returns 400 on bad sig (not 503)  
- [ ] End-to-end test-mode card success settles invoice via webhook  
- [x] Critical tables inventory + sample export  
- [ ] Full restore into scratch project completed once  
- [x] Outage P0 probes pass  
- [ ] `/api/functions/health` deployed and monitored  
- [ ] Storage bucket private + signed URLs  

Until unchecked items clear, treat TitanOS as **closed beta**, not open launch.
