# Production observability & email (Sentry + Resend)

TitanOS is migrating its canonical application to Cloudflare Workers. Observability and email secrets must follow the same production gate as the API routes that use them; do not copy privileged production credentials into the public migration preview simply to make tests pass.

## Current migration state

- Browser Sentry remains wired through `src/lib/sentry.js` when `VITE_SENTRY_DSN` is configured.
- API instrumentation is Worker-compatible enough for the current staged routes, but the final Cloudflare-native Sentry implementation/OTLP decision is still a migration task.
- The temporary `/api/functions/sentryDebug` fault-injection endpoint is retired and must remain unavailable.
- Resend-backed portal/email routes remain subject to their individual Cloudflare API certification gates.

## Configuration inventory

| Variable | Purpose |
|----------|---------|
| `SENTRY_DSN` | Server-side error reporting DSN |
| `VITE_SENTRY_DSN` | Browser error reporting DSN |
| `VITE_SENTRY_REPLAY=1` | Optional privacy-masked browser Session Replay; still requires product privacy controls |
| `SENTRY_ENVIRONMENT` | Optional environment label (`production`, `preview`, etc.) |
| `SENTRY_RELEASE` | Optional explicit release identifier |
| `OPS_ALERT_WEBHOOK_URL` or `SLACK_WEBHOOK_URL` | Optional operational 5xx alert target |
| `FEATURE_FLAGS_JSON` | Server-side boolean flag overlay for `/api/functions/featureFlags` |
| `ANALYTICS_INGEST_ENABLED=1` | Enables first-party analytics ingestion only after that route is certified |
| `VITE_ANALYTICS_INGEST=1` | Allows the client to flush analytics only when the server route is available |
| `RESEND_API_KEY` / `RESEND_FROM` | Server-side email provider configuration |
| `PORTAL_OTP_PEPPER` | Portal OTP hashing secret |
| `HEALTH_DEEP_SECRET` / `TITANOS_OPS_SECRET` | Operations authentication for protected deep health behavior |

## Sentry operating rule

1. Do not expose a public endpoint whose purpose is to deliberately throw an exception.
2. Keep `SENTRY_DSN` server-side. `VITE_SENTRY_DSN` is browser configuration and must never contain a privileged server credential.
3. Do not enable Node-native CPU profiling on the Cloudflare Worker runtime.
4. Validate server observability through controlled staging/runtime telemetry associated with a real handled test failure or a dedicated non-public certification mechanism.
5. Before production cutover, verify that error events include the intended environment/release and do not leak secrets, access tokens, request bodies containing sensitive data, or service-role credentials.

## Resend operating rule

Portal OTP and other email flows must fail closed when required provider configuration is absent. For Cloudflare production, provision `RESEND_API_KEY`, `RESEND_FROM`, and any route-specific secret only after that route family has passed authorization, abuse-control, provider-failure, and delivery-audit certification.

Do not treat successful secret provisioning as route certification by itself.
