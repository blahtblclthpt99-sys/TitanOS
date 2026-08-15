# TitanOS 2.0 / 5000X — Full System Audit Baseline

**Branch:** `security/titanos-5000x-full-system-audit`  
**Canonical base:** current `main` at audit start  
**Release status:** **NO-GO — hardening in progress**

This document is an evidence log, not a certification claim. A green Vercel preview build is not sufficient for release.

## Architecture inventory

TitanOS is a React/Vite application with Vercel serverless APIs, Supabase/Postgres/RLS, Stripe Billing/Checkout, Capacitor Android, PWA support, Sentry/structured error handling, and a broad Node/Playwright test suite.

Primary surfaces:

- Frontend: `src/pages`, `src/components`, React Query entity layer, global search, Driver Hub, Titan AI, communications, reports/exports, admin and settings.
- Server: `api/functions`, shared auth/CORS/rate-limit/entitlement/audit/AI/payment helpers under `api/_lib`.
- Database: `supabase/migrations`, RLS-protected public tables, service-only subscription/session/secret tables, helper RPCs and privilege-protection triggers.
- Payments: Stripe Checkout + signed raw-body webhook + idempotency table + server-side fee engine + subscription synchronization.
- Mobile/PWA: Capacitor Android project, service worker, native update gate, offline/local fallback modules.
- Testing: lint, typecheck, payment/security/auth/AI/driver/offline/a11y/perf/observability/scalability/final-QA suites, Playwright E2E, DB security, ship gate, ops drills.

## Verified P1 findings

### 1. Customer portal tenant ambiguity

Original OTP request logic could silently choose the first customer when the same email existed in more than one customer/owner relationship. Service-role portal reads were not consistently owner-scoped and `portalGetData` used broad projections.

**Status:** fixed on audit branch.

- ambiguous email now fails closed internally while preserving anti-enumeration response semantics;
- verification binds customer + owner + verified email;
- portal data uses explicit customer-safe fields;
- jobs/estimates/invoices are customer + owner scoped;
- estimate, invoice Checkout, and review mutations are owner scoped;
- legacy plaintext portal token lookup is disabled by default.

### 2. Portal review schema mismatch

The portal review endpoint wrote fields that do not exist in the live `job_reviews` schema and omitted required reviewer identity.

**Status:** fixed on audit branch to match live schema and tenant ownership.

### 3. Stripe settlement schema mismatch

The production webhook writes `invoices.paid_at`, but the live invoice schema does not currently expose that column.

**Status:** additive migration committed, **not yet applied to production**.

### 4. Payment-row authority weakness

RLS restricted payment rows to their owners, but authenticated clients could still mutate sensitive fields on rows they were allowed to update.

**Status:** migration committed to make settlement/provider/linkage/fee fields server-authoritative and make payment deletion admin-only. **Not yet applied to production**.

### 5. Core tenant ownership mutation

Company-member UPDATE policies allowed legitimate row access but did not freeze tenant ownership fields. A client with update rights could attempt to modify `created_by_id` / `company_id`.

**Status:** ownership-integrity trigger migration committed for customers/jobs/estimates/invoices. **Not yet applied to production**.

### 6. Public contract bearer tokens stored in plaintext

Public `SECURITY DEFINER` contract RPCs compared raw bearer tokens directly to `contracts.share_token`. A database disclosure would therefore disclose usable public signing links.

**Status:** replacement architecture committed; production migration pending.

- add/backfill `share_token_hash`;
- clear raw stored token;
- revoke anonymous/authenticated execution of public token RPCs;
- authenticated server endpoint rotates secure random tokens;
- public get/sign is rate-limited serverless code using token hashes and explicit response fields.

### 7. Titan AI owner-autopilot confirmation bypass

Current server logic can execute an allowlisted Titan write intent immediately when `ownerAutopilot` is enabled for an owner email.

**Status:** **OPEN P1 / RELEASE BLOCKER.**

The 5000X trust model requires:

`MODEL PROPOSES -> SERVER VALIDATES -> AUTHORIZATION -> TENANT CHECK -> USER CONFIRMATION WHEN REQUIRED -> EXECUTE -> AUDIT`

High-risk write intents must not bypass confirmation simply because the actor is the platform owner.

### 8. Titan Memory is not yet a production memory system

Current conversational memory is primarily a bounded device-local searchable log keyed by user ID. It does not yet implement the required typed, provenance-aware, tenant-aware durable memory with confidence and revocation semantics.

**Status:** **OPEN RELEASE BLOCKER for Context/Memory certification.**

## Invisible Interface status

The audit confirmed that the canonical source did not contain a complete functional Invisible Interface implementation.

A safe foundation is now committed:

- strict data-only schema sanitizer (`src/lib/invisibleInterface.js`);
- TitanOS renderer (`src/components/ai/InvisibleInterface.jsx`);
- deterministic server-owned interface builder (`api/_lib/invisibleInterface.js`);
- allowed action kinds are only internal navigation and a new prompt;
- arbitrary HTML/code/fetch/execution actions are rejected;
- regression test rejects external navigation and direct `execute` actions.

**Current status:** **NOT COMPLETE / RELEASE BLOCKER.**

The schema/renderer still must be wired end-to-end into `titanAI.js` and `AIAssistant.jsx`, then tested. Invisible Interface will not be certified until the server emits validated specs and the assistant renders them without introducing a mutation bypass.

## Historical regression verification

### Customer not found

The optimistic customer list used temporary IDs that could be clicked before persistence, producing `/customers/temp_*` and a false “Customer not found” state.

**Status:** fixed on the 5000X branch. Temporary rows are non-interactive until persisted.

### `job_checkins.geofence_m` schema-cache failure

Live Supabase inspection confirms the `job_checkins` table currently has both `geofence_ok` and `geofence_m` columns.

**Status:** live schema mismatch no longer present; full check-in E2E still required.

## RLS/database evidence

Live public-schema sweep showed RLS enabled on every current public table. Service-only tables intentionally expose no normal client policy. Existing triggers protect profile privilege fields, verified-worker state, referral paying state, and invoice paid status.

Remaining database gates:

- apply/test new 5000X migrations in a controlled environment before production;
- re-run security advisors and DB-security suite;
- resolve/validate migration ordering and duplicate numeric migration prefixes;
- validate foreign keys, monetary constraints, orphan handling, and cascade behavior end-to-end.

## Stripe evidence

Verified live Stripe account has one enabled production webhook pointing to:

`https://titanos-web.vercel.app/api/functions/stripeWebhook`

An older duplicate endpoint exists but is disabled. The enabled webhook includes Checkout completion/expiry/async failure, subscription create/update/delete, payment failures, and refunds.

Current source verifies Stripe signatures against the raw body and uses webhook-event idempotency.

Remaining Stripe release gates:

- apply `paid_at` / payment-authority migrations;
- verify a legitimate signed Checkout settles an invoice correctly;
- verify duplicate/replay handling with real event IDs;
- verify refund/invoice reconciliation behavior;
- verify trial/renewal/cancel/reactivate/payment-failure entitlement lifecycle.

## Subscription surface

A dedicated authenticated `/subscription` page and authoritative `subscriptionStatus` endpoint were added on this branch.

It displays server-backed plan, trial, founding/lifetime state, Stripe status, current period end, cancellation-at-period-end state, upgrade comparison, and customer-portal management.

Remaining: complete discoverability/navigation audit and lifecycle E2E.

## PWA / reliability evidence

Production logs contained stale-deployment lazy-module failures (`Failed to fetch dynamically imported module`). The service worker is navigation-network-first and caches hashed assets only after use.

The ErrorBoundary previously allowed only one automatic chunk reload for the entire session. It now uses a short incident cooldown so a long-lived tab can recover from later deployments without a reload loop.

Older `res.setHeader is not a function` error groups referenced functions no longer present in canonical source and are classified as stale-deployment artifacts, not current-source defects.

## Production preview evidence

The audit branch is connected to Vercel preview deployments. Multiple hardening commits have reached `READY` with `target: null`; production has not been changed.

This proves preview compilation/deployment for those commits only. It does not prove the complete test matrix, database migration state, Android parity, backup recovery, or payment lifecycle.

## Security regression coverage added

`test:security` source assertions now cover:

- portal duplicate-email fail-closed behavior;
- portal owner scoping and explicit response projection;
- plaintext portal token compatibility default-off;
- hashed public contract-token architecture;
- payment authority trigger;
- core tenant ownership trigger;
- Invisible Interface sanitizer rejecting external/direct execution actions.

These tests are committed but still require execution in an environment with the repository installed.

## Remaining certification blockers

Release remains **NO-GO** while any of the following remains unresolved:

1. Titan AI owner-autopilot server confirmation bypass.
2. Invisible Interface not wired and E2E verified.
3. Typed/permission-aware Titan Memory not implemented to 5000X standard.
4. New database migrations not applied/tested and migration state not fully reconciled.
5. Full required test matrix and `npm run gate:ship` not executed with recorded results.
6. Stripe live settlement/refund/subscription lifecycle not fully verified.
7. Android `cap:sync` / release AAB / parity not verified.
8. Backup restore and outage drills not executed/verified.
9. Supabase leaked-password protection remains disabled.
10. Release metadata/version still requires reconciliation with TitanOS 2.0 / 5000X.

## Certification decision

**NO-GO — hardening and verification are still in progress.**

Do not merge this branch or deploy it to production until the blockers above are closed and the full release gate has evidence-backed pass results.
