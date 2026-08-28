# TitanOS — Production deployment checklist

Run this before any TitanOS production cutover or production deployment. During the Cloudflare migration, the isolated `workers.dev` preview is certification infrastructure only; it is not production authorization.

## 0. Stop if any critical check fails

Do **not** deploy or change production DNS if build/lint/typecheck fails, required tests fail, secrets are committed, an API dependency is still unmigrated, payment/auth gates are incomplete, or `/__titanos/edge-health` is not in the expected release state.

## 1. Source-control and release integrity

- [ ] Release commit/PR reviewed; no `.env`, private keys, service-role keys, webhook secrets, APK signing material, dumps, or backups are tracked.
- [ ] Canonical TitanOS product surfaces remain present: TitanAI, Invisible Interface, Titan Support, Driver Hub/GPS, jobs, business/workspaces, payments, PWA/mobile integration.
- [ ] Migration branch is `infra/cloudflare-full-titanos-migration`; do not merge the destructive legacy Cloudflare migration branch.
- [ ] `production_cutover_ready` remains `false` until the final explicit production release gate.
- [ ] Every production-used `/api/*` route is recorded in `docs/CLOUDFLARE_API_MIGRATION_MATRIX.md` as `NATIVE_WORKER`, independently certified `EXTERNAL_BACKEND`, or `RETIRED`.
- [ ] Unmigrated routes fail closed with deterministic 503 behavior.
- [ ] The retired /api/functions/sentryDebug fault-injection route does not exist and remains unrouted.

## 2. Exact-head validation

Required on the exact runtime revision being considered for release:

```bash
npm ci
npm run lint
npm run typecheck
npm run test:auth
npm run test:api
npm run test:payments
npm run test:security
npm run test:ai
npm run test:driver
npm run test:gps
npm run test:offline
npm run build
npx wrangler deploy --dry-run
```

Also run the dedicated migration suites present in `.github/workflows/cloudflare-full-validate.yml`, including adapter, registration, profile-policy, and route-specific Cloudflare tests.

- [ ] `TitanOS Cloudflare Full App Validate` succeeds on the exact runtime SHA.
- [ ] `TitanOS Cloudflare Full App Preview` deploys that SHA to the isolated preview Worker and all runtime probes succeed.
- [ ] No test was weakened or skipped merely to obtain green CI.

## 3. Cloudflare runtime configuration

Use Cloudflare's runtime secret/configuration facilities for server-side values. Never expose privileged credentials through `VITE_*` variables.

| Variable | Requirement | Notes |
|----------|-------------|-------|
| `VITE_SUPABASE_URL` | Required for browser app | Public project URL |
| `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY` | Required for browser app | Public anon/publishable credential only |
| `SUPABASE_URL` | Required by server routes that use Supabase | Server-side |
| `SUPABASE_SERVICE_ROLE_KEY` | Required only by certified privileged server routes | **Server-side only** |
| `VITE_TITANOS_PUBLIC_ORIGIN` | Required for final web release | Canonical HTTPS origin |
| `VITE_API_BASE_URL` | Required for packaged native app | Final certified production HTTPS API origin; browser web uses same-origin by default |
| `APP_ORIGIN` / allowed-origin configuration | Route-specific | Must reference intended production origins only |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Payment gate only | Do not provision as evidence of certification; payment routes need independent tests |
| `VITE_SENTRY_DSN` | Optional browser observability | Public browser DSN configuration |
| `SENTRY_DSN` | Optional server observability | Server-side |
| `RESEND_API_KEY` / `RESEND_FROM` | Email-route gate only | Server-side |
| `OPENAI_API_KEY` | TitanAI provider gate only | Server-side |
| `HEALTH_DEEP_SECRET` / `TITANOS_OPS_SECRET` | Ops gate | Server-side |

- [ ] No `LEGACY_API_ORIGIN`, retired `.vercel.app` runtime fallback, or Vercel production URL remains in executable Cloudflare/browser routing configuration.
- [ ] No `SENTRY_DEBUG_ROUTE` or Node-native CPU profiler flag is configured for Workers.
- [ ] Preview secrets are non-production unless a deliberate, isolated integration test environment has been approved.

## 4. Supabase / identity / authorization

- [ ] All required migrations for the release are applied and verified against the intended production project; code presence alone is not sufficient.
- [ ] The profile referral/company-context hardening migration is applied before relying on its database backstop.
- [ ] RLS prevents client-side privilege, payment-state, tenant, and referral-attribution escalation.
- [ ] `auth/me` authenticated GET/PATCH behavior has been tested against a non-production integration environment before promotion.
- [ ] Registration create/duplicate/email-confirmation and durable abuse controls have been integration-tested before promotion.
- [ ] OAuth callback/redirect allowlists contain only intended TitanOS production/mobile origins and required local development entries.

## 5. Money / billing

Do not infer payment readiness from compilation or a successful generic Worker deploy.

- [ ] Stripe webhook raw request body is preserved exactly for signature verification.
- [ ] Webhook signature validation, replay/idempotency, duplicate delivery, authoritative database transitions, refunds, and reconciliation are tested.
- [ ] Checkout/payment-link/subscription routes validate ownership and authoritative server-side amounts/plans.
- [ ] Redirect and return URLs are allowlisted.
- [ ] Client code cannot directly mark payments/orders/subscriptions successful or refunded.
- [ ] Payment feature flags remain fail-closed until the corresponding financial routes are certified.

## 6. TitanAI / Support / streaming

- [ ] `/api/functions/titanAICapabilities` contract matches actual route/auth behavior.
- [ ] TitanAI main route passes authentication, entitlement, workspace isolation, provider-failure, rate-limit, and action-confirmation testing before migration.
- [ ] TitanAILive uses true Worker streaming/SSE semantics; do **not** route it through the current buffered Node-handler adapter.
- [ ] Titan Support routes pass user/workspace/agent authorization and case-state integrity tests before migration.
- [ ] AI/action logs and observability do not expose tokens, secrets, sensitive request bodies, or service-role credentials.

## 7. PWA / Android / device capabilities

- [ ] Root and deep-link navigation work on the final origin.
- [ ] Service worker and manifest use correct caching/content-type behavior.
- [ ] Camera, microphone, geolocation, payment permissions, and mobile navigation function under final CSP/Permissions-Policy.
- [ ] Android workflow no longer points to the disabled Vercel backend before release packaging is re-enabled.
- [ ] `VITE_API_BASE_URL`, OAuth/deep-link callback configuration, and Android regression tests are updated together for the final production origin.

## 8. Production domain and DNS cutover

Only after all dependent API families are certified:

- [ ] Exact production hostname and Cloudflare zone/account verified.
- [ ] Existing DNS records inventoried before modification.
- [ ] TLS certificate/hostname coverage verified.
- [ ] Production Worker custom-domain/route configuration reviewed separately from preview configuration.
- [ ] Rollback target and DNS/route rollback steps documented before change.
- [ ] Maintenance/monitoring window selected for cutover.
- [ ] No preview workflow contains production route/domain attachment commands.

## 9. Post-cutover smoke

- [ ] `/__titanos/edge-health` returns the intended production release state and native API count.
- [ ] Landing page and authenticated shell load.
- [ ] Hard refresh of representative deep routes succeeds.
- [ ] Login/OAuth returns to TitanOS correctly.
- [ ] Jobs, customers, invoices, business/workspace switching, Driver Hub/GPS, TitanAI, Titan Support, and critical settings load without silent fallback.
- [ ] Payment smoke uses controlled production-safe verification and shows no duplicate state transition.
- [ ] Security headers and CSP are present on HTML/API responses.
- [ ] Error monitoring receives controlled telemetry without leaking secrets.
- [ ] Android/PWA clients resolve the new API origin correctly.

## 10. Rollback

If a critical regression appears:

1. Stop further migrations and payment-impacting actions.
2. Restore the previously certified Cloudflare Worker revision/route configuration.
3. Restore prior DNS only if the cutover itself caused the failure and the previous backend is still known healthy; do not point users back to a disabled Vercel deployment.
4. Verify auth, API health, and payment state before reopening traffic.
5. Record the failed revision, symptom, affected routes, and recovery evidence before attempting another cutover.

## Release rule

A green preview is necessary but not sufficient for production. Production remains **NO-GO** until the migration matrix, integration secrets, database migrations, payment gates, mobile origin changes, and final DNS/rollback checks are all independently evidenced.
