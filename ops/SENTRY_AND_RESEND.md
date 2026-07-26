# Production observability & email (Sentry + Resend)

Code is wired for **Node.js API** (`api/instrument.mjs` + `api/_lib/sentry.js`) and **React** (`src/lib/sentry.js`). These are **ops configuration** steps — do not invent DSNs/keys.

## Current Vercel Production

| Variable | Purpose |
|----------|---------|
| `SENTRY_DSN` | Node.js / Vercel serverless (`api/instrument.mjs`) |
| `VITE_SENTRY_DSN` | Browser (`src/lib/sentry.js`); also fallback for API if `SENTRY_DSN` unset |
| `VITE_SENTRY_REPLAY=1` | Enable privacy-masked Session Replay (still requires user Privacy opt-in) |
| `SENTRY_ENVIRONMENT` | Optional override (`production` / `preview`) |
| `SENTRY_DEBUG_ROUTE=1` | Enables `GET /api/functions/sentryDebug` for setup verification |
| `OPS_ALERT_WEBHOOK_URL` or `SLACK_WEBHOOK_URL` | Page ops on API 5xx |
| `FEATURE_FLAGS_JSON` | Server-side boolean flag overlay for `/api/functions/featureFlags` |
| `ANALYTICS_INGEST_ENABLED=1` | Accept first-party analytics batches |
| `VITE_ANALYTICS_INGEST=1` | Client will flush analytics buffer to API |
| `RESEND_API_KEY` / `RESEND_FROM` | Portal OTP email |
| `PORTAL_OTP_PEPPER` | Portal OTP hashing |
| `HEALTH_DEEP_SECRET` | Header `x-titanos-ops` for `?deep=1` health |

## Sentry Node.js setup (done in code)

Per [Sentry Instrument](https://skills.sentry.dev/instrument) Node defaults:

- Errors + tracing (`tracesSampleRate` 1.0 preview/dev, 0.1 production)
- `includeLocalVariables`, `enableLogs`
- Optional CPU profiling via `@sentry/profiling-node` when `SENTRY_PROFILING=1` and the native addon loads
- Serverless flush after `captureApiException`

## Ops checklist

1. Create a Sentry project (Node.js and/or React).
2. Vercel → Environment Variables (Production + Preview):
   - `SENTRY_DSN` — API
   - `VITE_SENTRY_DSN` — browser (rebuild required)
3. Redeploy.
4. Temporarily set `SENTRY_DEBUG_ROUTE=1`, then open:
   - `https://titanos-web.vercel.app/api/functions/sentryDebug`
5. Confirm the issue in Sentry within ~30s, then unset `SENTRY_DEBUG_ROUTE`.

Without DSNs, init / capture are safe no-ops.

## Resend (required for portal OTP email)

Portal OTP **fails closed** without Resend (`api/functions/portalRequestOtp.js`).

1. Create Resend API key + verified sending domain.
2. Vercel → add `RESEND_API_KEY`, `RESEND_FROM`, `PORTAL_OTP_PEPPER`.
3. Redeploy and test `/portal` OTP.
