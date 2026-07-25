# TitanOS — Production deployment checklist

Run this **before every** production deploy (Vercel `--prod` or GitHub merge to `main` with auto-deploy).

## 0. Stop if any critical check fails

Do **not** deploy if build/lint fails, secrets are in the commit, or payment/auth smoke fails.

---

## 1. Source control hygiene

- [ ] Working tree reviewed (`git status`) — no `.env`, keys, APKs, or backup dumps
- [ ] `.env.production` is **not** tracked (use Vercel env + local ignored file / `.env.production.example`)
- [ ] Migrations **016–019** applied on Supabase (hire RLS, fee engine, Stripe idempotency, payment/hire/notify lockdown) **or** explicitly deferred with risk accepted
- [ ] No `sk_`, `service_role`, or webhook secrets in client (`VITE_*`) code

## 2. Local verify (required)

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

- [ ] Typecheck exit 0
- [ ] Lint exit 0
- [ ] Unit tests (`test:fees` + `test:hire`) exit 0
- [ ] Production build exit 0

## 3. Vercel environment variables

Project → Settings → Environment Variables (Production + Preview as needed):

| Variable | Required | Notes |
|----------|----------|--------|
| `VITE_SUPABASE_URL` | Yes | Project URL |
| `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Public anon only |
| `VITE_TITANOS_PUBLIC_ORIGIN` | Recommended | Canonical site URL |
| `VITE_API_BASE_URL` | Recommended | Same origin on Vercel web |
| `SUPABASE_URL` | Yes (API) | Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (API) | **Server only** |
| `STRIPE_SECRET_KEY` | For live pay | Server only |
| `STRIPE_WEBHOOK_SECRET` | For settle | Server only |
| `VITE_SENTRY_DSN` | Optional | Browser Sentry DSN (client) |
| `SENTRY_DSN` | Optional | API Sentry DSN (server; falls back to `VITE_SENTRY_DSN`) |
| `RESEND_API_KEY` / `OPENAI_API_KEY` | Optional | Server only |

- [ ] No Base44 / `VITE_TITANOS_APP_ID` required (legacy — ignore old docs)

## 4. Supabase / money

- [ ] Auth redirect URLs include `https://titanos-web.vercel.app/**` and Preview URLs if used
- [ ] Hire RLS (`016`) + lockdown (`019`) applied if hire board is live
- [ ] Fee tables (`017`) applied if Admin Fees / DB rates are live
- [ ] Stripe webhook idempotency table (`018`) applied — webhook **fails closed** without it
- [ ] Payments: client cannot set `succeeded`/`refunded` (RLS `019` + UI)
- [ ] Stripe webhook endpoint pointing at `/api/functions/stripeWebhook` with raw body
- [ ] `GET /api/functions/health` → `ok`
- [ ] `GET /api/functions/health?deep=1` → supabase `ok` (no raw DB errors in body)

## 5. Deploy

```bash
# Preferred: merge to main if Vercel Git integration is connected
# Or:
npx vercel deploy --prod --yes
```

Windows TLS tip if CA errors: `$env:NODE_OPTIONS='--use-system-ca'`

- [ ] Deploy succeeds
- [ ] Aliased production URL responds (https://titanos-web.vercel.app)

## 6. Post-deploy smoke (5 minutes)

- [ ] Landing loads
- [ ] Login / OAuth return-to still lands in-app
- [ ] Dashboard / Jobs load (or friendly empty/error — no white screen)
- [ ] Hard refresh a deep link e.g. `/jobs` (SPA rewrite works)
- [ ] Payments: stub/misconfig shows fail-closed toast (no fake success)
- [ ] `/admin/fees` admin-only; non-admin denied
- [ ] Mobile width: bottom nav + Profile tab

## 7. Rollback

If critical: Vercel → Deployments → previous good → **Promote to Production**.

---

## Risk notes

| Change | Risk | Safer alternative |
|--------|------|-------------------|
| Deleting unused shadcn deps (`carousel`, `cmdk`, …) | May break future UI imports | Leave stubs; remove only after usage grep + QA |
| Applying migrations mid-traffic | Brief policy change | Apply in maintenance window; keep `BEGIN`/`COMMIT` |
| Forcing typecheck green | Large unrelated churn | Keep Vite build as CD gate; tighten JS types gradually |
| Committing `.env.production` “for convenience” | Key leak | Vercel env + local ignored file only |
