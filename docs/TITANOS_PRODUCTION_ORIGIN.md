# TitanOS canonical production origin

Canonical production web origin:

`https://app.titanfieldos.com`

This hostname is the single production origin for TitanOS web authentication, Cloudflare `APP_ORIGIN`, browser/native API fallback configuration, Stripe return URLs, and Supabase Auth redirect allow-listing.

## Routing intent

- `app.titanfieldos.com` → TitanOS application Worker
- `titanfieldos.com` → reserved for marketing/landing or redirect to the app
- `*.workers.dev` → preview/bootstrap/testing only; not the canonical business-critical production origin

## Required production values

- `VITE_TITANOS_PUBLIC_ORIGIN=https://app.titanfieldos.com`
- `VITE_API_BASE_URL=https://app.titanfieldos.com` for native/Capacitor production builds
- `APP_ORIGIN=https://app.titanfieldos.com`
- `SUPABASE_URL=https://xcfjpxcmokdfwkarwomy.supabase.co`

`wrangler.jsonc` is the source of truth for the Cloudflare public bindings and required production secret names. The read-only production certifier is locked to the same canonical origin, so no separate GitHub repository variable is required for the origin.

Do not restore `titanos-web.vercel.app` as a production origin.
