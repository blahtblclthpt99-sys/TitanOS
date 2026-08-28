# TitanOS Cloudflare Migration Runbook

## Purpose

Move TitanOS from Vercel-hosted delivery to Cloudflare Workers without an unsafe all-at-once cutover. Production DNS remains unchanged until the Cloudflare runtime, application behavior, backend parity, and production integrations are independently certified.

## Current migration architecture

- Cloudflare Workers Static Assets serves the Vite `dist/` application.
- `cloudflare/worker.js` is the Cloudflare request entry point and uses the `ASSETS` binding for application assets.
- `/api`, `/api/*`, and `/__titanos/*` are explicitly Worker-first so SPA asset fallback cannot intercept backend requests.
- `/__titanos/edge-health` reports the Cloudflare runtime and whether required runtime bindings are present.
- `/api/attention/create-checkout` and `/api/functions/stripeWebhook` have Cloudflare-native implementations for Titan Attention.
- Unported `/api` routes fail closed with HTTP 404 on the Cloudflare Worker; the preview does **not** silently proxy them to Vercel.
- Automated preview certification deploys only to the dedicated `titanos-ci-preview` Worker on its `workers.dev` hostname.
- The Worker named `titanos-preview` is reserved from preview CI because a prior certification run observed the live Titan Stripe webhook routed there. CI must not overwrite its code or secrets.
- Vercel is not part of the Cloudflare runtime path for this branch.

Cloudflare Workers Static Assets is the intended hosting model for this migration. The Worker and static assets deploy together, and `env.ASSETS.fetch()` is the supported runtime binding used by the Worker entry point.

## Required GitHub repository secrets for isolated preview

Do not commit either value to the repository.

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The preview workflow intentionally does **not** consume production Stripe credentials or production Supabase service-role credentials. It generates inert, run-scoped application bindings so runtime behavior can be tested without giving the public preview financial or database authority.

Cloudflare recommends a user API token scoped to the target account as narrowly as possible. For Worker script deployment, grant only the Worker deployment permission required for preview. DNS/custom-domain permissions are a separate production-cutover capability and must not be added merely to make preview deployment convenient.

## Cloudflare API token setup

1. Open Cloudflare Dashboard > My Profile > API Tokens.
2. Create a custom token or start from the Edit Cloudflare Workers template.
3. Restrict Account Resources to the Cloudflare account that will host TitanOS.
4. Grant only the minimum Worker-script deployment permission required for preview.
5. Do not use the Global API Key.
6. Store the token only as GitHub Actions secret `CLOUDFLARE_API_TOKEN`.
7. Store the Cloudflare account ID only as GitHub Actions secret `CLOUDFLARE_ACCOUNT_ID`.

## Preview deployment

Workflow: `TitanOS Cloudflare Preview Deploy`

Allowed branch: `infra/cloudflare-workers-migration`

The workflow is fail-closed. It:

1. verifies the Cloudflare deployment credentials exist;
2. verifies the target is exactly the isolated `titanos-ci-preview` Worker and rejects the reserved `titanos-preview` Worker name;
3. generates inert Stripe/Supabase application bindings for that workflow run;
4. installs dependencies with `npm ci`;
5. builds production assets;
6. rejects legacy Vercel runtime references from the Cloudflare deployment surface;
7. performs a pinned Wrangler dry-run compile;
8. uploads the inert bindings only to `titanos-ci-preview`;
9. deploys only `titanos-ci-preview`;
10. verifies `/__titanos/edge-health`;
11. verifies retired/unported API routes fail closed;
12. verifies checkout method and no-auth boundaries without database authority;
13. verifies Stripe webhook signature parsing with a synthetic non-financial event;
14. self-audits the workflow for production Stripe/Supabase secret references and any Stripe webhook-endpoint API access.

The preview workflow is a **runtime smoke certification**, not a production-integration certification. It must never be used to infer the current live Stripe webhook destination.

## Required preview certification

Do not merge the migration PR or switch production DNS until all applicable gates pass.

### Edge and SPA

- `/__titanos/edge-health` returns HTTP 200.
- Root application loads.
- Direct navigation to a deep SPA route loads correctly.
- Refresh on a deep route does not return 404.
- Immutable assets receive long-lived cache policy.
- HTML, service worker, and manifest remain revalidation-safe.
- Security headers are present.
- API and internal health responses are not cached.

### Browser authentication and Supabase

These checks exercise the browser application's configured public Supabase integration; they do not grant the Worker a production service role.

- Sign in succeeds.
- Session refresh succeeds.
- Sign out succeeds.
- Authenticated reads work.
- Authorized writes work.
- RLS denies unauthorized access.
- OAuth callback/redirect behavior uses the intended Cloudflare origin.

### API migration parity

Every production-used `/api` route must be classified before cutover as one of:

- **Ported and certified on Workers**;
- **Deliberately routed to a separately certified backend origin**; or
- **Retired and verified unused**.

An unclassified route is a production cutover blocker. The preview Worker currently fails unported routes closed rather than hiding missing migration work behind a compatibility proxy.

### Driver Hub and device capabilities

- Geolocation permission can be requested.
- Camera permission can be requested where required.
- Microphone permission can be requested where required.
- GPS-driven workflows function over HTTPS.
- Background/foreground transitions do not corrupt active driver state.

### TitanAI and Titan Support

- TitanAI live invocation succeeds against its intended production-compatible backend path.
- Titan Support live invocation succeeds.
- Authentication/authorization is preserved.
- Offline fallback appears only when the live service is truly unavailable.
- No missing `/api` dependency is masked as a client-side success.

### Payments

Preview runtime smoke:

- checkout rejects unsupported methods;
- unauthenticated checkout fails closed;
- webhook raw-body signature verification works;
- synthetic non-financial webhook events are safely ignored;
- no preview step can inspect or retarget a live Stripe webhook;
- no preview Worker receives production Stripe or production Supabase service-role credentials.

Production payment certification is separate and must verify:

- the current live Stripe webhook destination immediately before cutover;
- the final production webhook points only to the intended production Cloudflare Worker/custom domain, never the CI preview Worker;
- the exact enabled-event set and production signing secret match the final endpoint;
- real authenticated checkout creation against the intended Stripe account;
- exact price/amount integrity;
- customer-portal redirects where applicable;
- raw-body webhook signature verification with the production endpoint secret;
- webhook idempotency and duplicate-event handling;
- refund/cancellation/reversal behavior;
- authoritative database state transitions;
- rollback behavior if Cloudflare payment processing fails certification.

No production payment endpoint may move solely because the frontend or isolated preview works.

### PWA and mobile

- Manifest loads with correct content type.
- Service worker update behavior is correct.
- PWA deep links load through the Cloudflare SPA fallback.
- Capacitor/WebView API calls reach the intended API origin.
- Android app links/deep links are checked before production cutover.

### Observability and security

- Sentry connectivity is permitted by CSP where configured.
- Supabase HTTPS/WSS connectivity is permitted by CSP.
- Frame protection, MIME sniff protection, referrer policy, HSTS, and cross-origin opener policy are present.
- Camera/microphone/geolocation/payment permissions are restricted to self rather than globally disabled.
- API responses are `no-store`.
- Request correlation/trace identifiers are preserved where implemented.
- Preview credentials cannot authorize production application mutations.

## Production cutover gate

Cutover remains **NO-GO** until all of the following are true:

1. the migration PR is green and reviewable;
2. the isolated Cloudflare preview passes runtime/SPA/security certification;
3. every production-used API path has an explicit migration disposition;
4. auth/OAuth redirect URLs are registered for the production Cloudflare origin;
5. TitanAI, Titan Support, Driver Hub/GPS, and required business workflows pass on the target origin;
6. production Stripe integration is certified separately from preview smoke testing;
7. the production Worker has only the minimum required production secrets and bindings;
8. custom-domain/TLS configuration is validated before traffic movement;
9. the exact production Worker version, custom-domain/DNS state, and Stripe endpoint state are recorded immediately before cutover;
10. a Cloudflare-native rollback procedure is documented and executable without depending on preview CI or an obsolete Vercel runtime path.

## Stripe webhook cutover rule

The production Stripe webhook endpoint must never be changed by the preview deployment workflow.

When the Cloudflare production payment endpoint is independently certified, webhook routing may be changed only as an explicit cutover action with:

- the exact destination URL verified before mutation;
- the required event set verified;
- the previous endpoint URL and event set recorded for rollback/audit;
- a post-change signed event verification;
- an immediate rollback path if verification fails.

The CI Worker `titanos-ci-preview` is never an allowed live Stripe webhook target.

## Immediate rollback

If Cloudflare production behavior differs from the certified target behavior, stop the cutover and restore the last recorded known-good Cloudflare Worker/version and routing state. If the fault is domain/DNS-specific, restore the recorded pre-cutover DNS/routing state. If the fault is payment-specific, restore the recorded pre-cutover Stripe endpoint state before retrying. Do not debug authentication, payment, data-integrity, or routing regressions while affected production traffic remains on a failing path.
