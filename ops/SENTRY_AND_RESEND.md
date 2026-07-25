# Production observability & email (Sentry + Resend)

Code is already wired. These are **ops configuration** steps — do not invent DSNs/keys.

## Current Vercel Production (verified)

| Variable | Status |
|----------|--------|
| `VITE_SUPABASE_*` / `SUPABASE_*` | Set |
| `STRIPE_SECRET_KEY` | Set |
| `STRIPE_WEBHOOK_SECRET` | Set |
| `VITE_SENTRY_DSN` / `SENTRY_DSN` | **Missing** |
| `RESEND_API_KEY` / `RESEND_FROM` | **Missing** |
| `PORTAL_OTP_PEPPER` | **Missing** (falls back to service role / weak default) |

## Sentry (optional but recommended)

1. Create a Sentry project (React + Node).
2. Vercel → Environment Variables (Production + Preview):
   - `VITE_SENTRY_DSN` — browser (`src/lib/sentry.js`)
   - `SENTRY_DSN` — API (`api/_lib/sentry.js`)
3. Redeploy (client DSN is build-time).
4. Confirm: throw a test error in Preview; event appears in Sentry.

Without DSNs, `initSentry` / `captureApiException` are safe no-ops.

## Resend (required for portal OTP email)

Portal OTP **fails closed** without Resend (`api/functions/portalRequestOtp.js`).

1. Create Resend API key + verified sending domain.
2. Vercel → add:
   - `RESEND_API_KEY=re_...`
   - `RESEND_FROM=TitanOS <noreply@yourdomain.com>`
   - `PORTAL_OTP_PEPPER=` long random string (do not reuse service role)
3. Redeploy (server env is runtime).
4. Test `/portal` OTP request — email arrives; health unchanged.

## Git / Production parity

- GitHub: `https://github.com/blahtblclthpt99-sys/TitanOS.git`
- Branch: `main` tracks `origin/main`
- **Risk:** large local uncommitted hardening tree. Prefer commit → push → Vercel Git deploy so Production matches `main`, not only CLI uploads.

## Preview vs Production build

Same Vite build (`npm run build`). Ensure Preview also has Supabase + Stripe vars if Preview is used for payment QA.
