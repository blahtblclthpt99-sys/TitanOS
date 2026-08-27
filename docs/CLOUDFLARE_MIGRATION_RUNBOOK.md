# TitanOS Cloudflare Migration Runbook

## Purpose

Move TitanOS from Vercel-hosted edge delivery to Cloudflare Workers without an unsafe all-at-once cutover. Production DNS remains unchanged until the Cloudflare preview is certified.

## Current architecture

- Cloudflare Workers Static Assets serves the Vite `dist/` application.
- `/api` and `/api/*` are temporarily proxied to the legacy Vercel origin.
- `/__titanos/edge-health` verifies the Cloudflare runtime and compatibility bridge.
- The preview Worker is intentionally isolated as `titanos-preview`.
- Vercel remains rollback infrastructure until Cloudflare certification is complete.

## Required GitHub repository secrets

Do not commit either value to the repository.

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Cloudflare recommends a user API token scoped to the target account as narrowly as possible. For Worker script deployment, the essential account permission is Workers Scripts Write/Edit. If later deployment adds Worker routes or DNS/custom-domain changes, grant those permissions separately rather than broadening the preview token prematurely.

## Cloudflare API token setup

1. Open Cloudflare Dashboard > My Profile > API Tokens.
2. Create a custom token or start from the Edit Cloudflare Workers template.
3. Restrict Account Resources to the Cloudflare account that will host TitanOS.
4. For this preview phase, grant the minimum Worker-script deployment permission needed by Wrangler.
5. Do not use the Global API Key.
6. Copy the token once and store it only as the GitHub Actions secret `CLOUDFLARE_API_TOKEN`.
7. Copy the Cloudflare account ID into GitHub Actions secret `CLOUDFLARE_ACCOUNT_ID`.

## GitHub setup

Repository: `blahtblclthpt99-sys/TitanOS`

GitHub > Settings > Secrets and variables > Actions > New repository secret.

Create:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Never place these values in `.env`, `wrangler.jsonc`, workflow source, PR comments, issues, screenshots, or chat messages.

## Preview deployment

1. Open GitHub Actions.
2. Select `TitanOS Cloudflare Preview Deploy`.
3. Select `Run workflow`.
4. Run it from branch `infra/cloudflare-workers-migration` only.

The workflow is fail-closed. It:

1. verifies the two required Cloudflare secrets exist;
2. installs dependencies with `npm ci`;
3. builds production assets;
4. performs a Wrangler dry-run compile;
5. deploys only the isolated `titanos-preview` Worker;
6. retrieves the deployment URL;
7. requests `/__titanos/edge-health`;
8. fails unless the endpoint confirms the Cloudflare runtime and configured API bridge.

## Required preview certification

Do not merge the migration PR or switch production DNS until all applicable checks pass.

### Edge and SPA

- `/__titanos/edge-health` returns HTTP 200.
- Root application loads.
- Direct navigation to a deep SPA route loads correctly.
- Refresh on a deep route does not return 404.
- Immutable assets receive long-lived cache policy.
- HTML/service worker/manifest remain revalidation-safe.
- Security headers are present.

### Authentication and Supabase

- Sign in succeeds.
- Session refresh succeeds.
- Sign out succeeds.
- Authenticated Supabase reads work.
- Authorized writes work.
- RLS still denies unauthorized access.

### TitanOS API compatibility bridge

- Browser calls use same-origin `/api`.
- Cloudflare forwards `/api/*` to the legacy origin.
- Authorization headers survive the proxy.
- Request bodies survive the proxy.
- 4xx server decisions are preserved and are not hidden as offline fallback.
- External redirects such as Stripe remain external.
- Legacy-origin redirects are rewritten to the Cloudflare origin where appropriate.

### Driver Hub and device capabilities

- Geolocation permission can be requested.
- Camera permission can be requested where the product requires it.
- Microphone permission can be requested where voice features require it.
- GPS-driven workflows function over HTTPS.

### TitanAI and Titan Support

- TitanAI live invocation succeeds.
- Titan Support live invocation succeeds.
- Authentication/authorization is preserved.
- Offline fallback appears only when the live service is truly unavailable.

### Payments

- Stripe checkout creation works.
- Customer-portal redirects work.
- Webhook production handling remains on the certified legacy backend until the webhook is explicitly ported and separately tested on Workers.
- Duplicate/idempotency protections remain intact.
- No production payment endpoint is moved solely because the frontend preview works.

### PWA and mobile

- Manifest loads with correct content type.
- Service worker update behavior is correct.
- Capacitor/WebView API calls can reach the intended API origin.
- Android deep-link and navigation behavior is checked before production cutover.

### Observability and security

- Sentry connectivity is not blocked by CSP.
- Supabase HTTPS/WSS connectivity is allowed by CSP.
- Frame protection, MIME sniff protection, referrer policy and HSTS are present.
- Camera/microphone/geolocation/payment permissions are restricted to self rather than globally disabled.
- API responses are not cached.

## Production cutover gate

Only after preview certification:

1. migrate or deliberately retain each backend API dependency;
2. port high-risk financial endpoints separately;
3. port and certify Stripe webhook raw-body signature verification;
4. configure the production Worker/custom domain;
5. verify TLS and DNS state;
6. perform production smoke tests;
7. retain Vercel for rollback during the observation window;
8. retire Vercel only after rollback is no longer required.

## Immediate rollback

If Cloudflare production behavior differs from the certified preview, restore traffic to the known-good legacy origin and investigate before attempting another cutover. Do not debug a financial or authentication regression while leaving affected production traffic on the failing path.
