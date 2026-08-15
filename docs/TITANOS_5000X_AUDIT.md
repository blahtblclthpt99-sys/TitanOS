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

## 5000X hardening status — 2026-08-15

- Titan owner-autopilot write bypass removed. Owner identity no longer bypasses confirmation for Titan write intents.
- Invisible Interface is wired into Titan's canonical response and confirmation path. The server emits deterministic sanitized interface specs; the client renders those specs without granting execution authority to generated UI.
- Titan durable memory retrieval now uses server-side, bounded, user-owned `titan_memory_nodes` data. Retrieval is explicitly scoped by `user_id` and `created_by_id`, excludes archived memory, preserves provenance/confidence/timestamps, strips secret-like fields, and caps injected memory.
- Titan prompt grounding explicitly separates authoritative business snapshot, durable memory, general knowledge and unknown information. Current authoritative business records win conflicts with remembered context.
- Customer portal duplicate-email ambiguity fails closed, sessions remain tenant-bound, portal queries use explicit projections, and plaintext legacy token compatibility is disabled by default.
- Public contract bearer tokens are hashed at rest; raw stored share tokens have been cleared and legacy public token RPC execution revoked.
- Payment settlement/provider/linkage authority is protected server-side and core tenant ownership fields are frozen for normal client updates.
- Production schema now includes `invoices.paid_at` required by the Stripe settlement path.
- Android backups are disabled and coarse/fine location permissions are explicitly declared.
- Full `npm run gate:ship` passed in GitHub Actions after a clean `npm ci` on the hardened branch.

## Database deployment evidence

The following 5000X migrations were applied successfully to the production Supabase project and verified after application:

- `invoice_payment_settlement_integrity`
- `payment_authority_lockdown`
- `core_tenant_ownership_lockdown`
- `contract_share_token_hashing`

Post-migration verification confirmed the invoice settlement column and contract token hash column exist, zero contracts retain both a raw and hashed share token, and payment/core tenant authority triggers are installed.

## Remaining certification gates

Repository ship-gate success does not by itself certify every external production dependency. Final commercial certification still requires evidence for any applicable external/live gates not covered by `gate:ship`, especially:

1. Real Stripe subscription lifecycle verification covering renewal, cancel/reactivate, payment failure and refund reconciliation without charging unintended customers.
2. Signed Android release AAB generated from the exact release source and device-tested for auth, payments, Titan AI, Invisible Interface, portal, Driver Hub and deep links.
3. Backup restore and outage drill evidence where production credentials/infrastructure access are required.
4. Supabase Auth leaked-password protection enabled and rechecked.
5. Two-account adversarial RLS/IDOR E2E evidence for critical cross-tenant flows.

## Certification decision

**REPOSITORY / BUILD GATE: PASS.**  
**FINAL EXTERNAL PRODUCTION CERTIFICATION: pending remaining live-environment gates above.**

Do not describe TitanOS 2.0 / 5000X as fully production-certified until those external gates are evidenced.