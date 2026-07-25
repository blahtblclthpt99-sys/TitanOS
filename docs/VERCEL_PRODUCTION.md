# TitanOS on Vercel — Production guide

TitanOS is a **Vite + React SPA** with **Vercel Serverless** handlers under `/api`. Auth and data are **Supabase**. There is **no Base44** runtime.

For the pre-flight checklist used on every release, see [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md).

---

## How deploys work

1. **GitHub** — push/PR to `main` runs `.github/workflows/ci.yml` (lint, fee tests, `vite build`).
2. **Vercel** — builds with `npm run build`, output `dist/`, SPA rewrites in `vercel.json`.
3. **API** — files in `api/functions/*` map to `/api/functions/<name>`.

```text
GitHub PR → CI green → merge → Vercel Production
Rollback  → Vercel Deployments → Promote previous
```

---

## Environment variables (authoritative)

Set in **Vercel → Project → Settings → Environment Variables**. Do **not** commit `.env.production`.

### Client (must be `VITE_*` — baked into the JS bundle)

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon / publishable key |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Optional alias of anon key |
| `VITE_TITANOS_PUBLIC_ORIGIN` | Canonical site (OAuth fallback) |
| `VITE_API_BASE_URL` | API origin (same site on Vercel web) |

### Server only (never `VITE_*`)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Same project URL for admin client |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role — bypasses RLS; protect this |
| `STRIPE_SECRET_KEY` | Live Checkout |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification |
| `RESEND_API_KEY` / `OPENAI_API_KEY` | Optional email / AI |

Templates: `.env.example`, `.env.production.example`.

---

## `vercel.json` notes

- **SPA rewrite** — non-file routes → `/index.html` so `/jobs`, `/payments`, etc. work on refresh.
- **Security headers** — CSP, HSTS, `X-Frame-Options`, etc.
- **Asset caching** — long-cache `/assets` and `/fonts`; `index.html` and `sw.js` revalidate.

If you add a new third-party API to the browser, extend CSP `connect-src` or requests will fail in production.

---

## Routing & errors

- Client routes: React Router in `App.jsx` / `TabStack.jsx` (lazy-loaded shells).
- Unknown routes: `PageNotFound`.
- React crashes: root + per-tab `ErrorBoundary` → friendly `AppError`.
- API failures: handlers return JSON `{ error }` with 4xx/5xx; client shows toasts / `ErrorState` and soft-falls back where designed (never fake payment success).

---

## Logging

Use `api/_lib/safeLog.js` for serverless errors. Health probes expose **status flags only** (no raw DB error strings). Do not `console.log` Authorization headers, Stripe payloads, or service keys.

---

## Operational excellence

| Item | Where |
|------|--------|
| Preview → Production | Vercel promotion or merge to `main` |
| Rollback | Deployments → previous → Promote |
| WAF / rate limits | Vercel Firewall on `/api/*` (Dashboard) |
| Log drains / APM | Dashboard (recommended: Sentry or Axiom) |
| Incident template | Detect → triage Vercel + Supabase → communicate → rollback → fix on Preview → post-mortem |

---

## Legacy warning

Older docs may mention **Base44**, `VITE_TITANOS_APP_ID`, or `VITE_TITANOS_API_URL`. Those are obsolete. Ignore them; use Supabase + `/api/functions/*` on this Vercel project.
