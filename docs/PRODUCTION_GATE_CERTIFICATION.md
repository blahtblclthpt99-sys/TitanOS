# TitanOS Cloudflare Production Gate Certification

## Release verdict: NO-GO

The full TitanOS Cloudflare application candidate is code-side certified through the last fully green runtime head, but production promotion remains locked until the exact current head and all external infrastructure, identity, payments, DNS, and release-governance gates pass.

### Code-side certification

Last fully green runtime head before this documentation-only refresh: `38bbb0f45d62e4095402f058df72c194b7e1314f`

Verified on the full-app candidate:

- Full TitanOS production boot path restored: `src/main.jsx` -> `src/App.jsx` -> `src/AuthenticatedShell.jsx`.
- TitanOS owns the root application; Titan Attention is preserved separately behind `/attention` and CSS-isolated with Shadow DOM.
- Complete application preservation/reachability gate passes.
- Destructive `src/**` / `api/**` migration deletions are rejected by CI.
- 39 active frontend-reachable privileged `/api/functions/*` handlers are explicitly Cloudflare-allowlisted.
- Direct browser API routes are source-audited and covered.
- `/api/register` and `/api/signup-emails` are Cloudflare-routed.
- Generic TitanOS Stripe webhook remains `/api/functions/stripeWebhook`.
- Titan Attention Stripe webhook is isolated at `/api/attention/stripe-webhook`.
- Unknown API routes fail closed.
- Browser API routing is Cloudflare-domain agnostic; native shells require configured `VITE_API_BASE_URL`.
- Server registration requires email confirmation by default.
- `wrangler.jsonc` explicitly requires `nodejs_compat` and CI prevents removal.
- Full production Vite build passes.
- Wrangler Cloudflare deploy dry-run passes.
- Lint and typecheck pass.
- Payment security suite passes.
- Security regression suite passes.
- Production hardening suite passes.
- Integration merge suite passes.
- Final QA suite passes.
- Cloudflare edge Vercel-independence gate passes.
- Titan Attention build passes.

### Production gates still locked

Do not authorize production until all of the following are independently verified:

1. Exact current branch head passes the complete certification matrix.
2. Intended production Cloudflare Worker `titanos` exists and deployment metadata matches the approved candidate.
3. Required production secret names are present; secret values are never printed into CI logs.
4. Production `APP_ORIGIN` is the final HTTPS canonical TitanOS origin.
5. Production custom domain / route is attached intentionally and DNS is verified.
6. Supabase production auth redirect/site URL configuration includes the final Cloudflare domain.
7. Supabase leaked-password protection and remaining production security advisor findings are resolved or formally accepted.
8. The correct TitanOS Stripe account is connected and independently identified; DealForge Stripe must not be repurposed.
9. The live TitanOS Stripe webhook points to the certified Cloudflare endpoint with the required event set and signing secret.
10. A controlled paid end-to-end transaction proves Checkout -> signed webhook -> authoritative database state -> customer-visible state -> reconciliation/refund behavior.
11. Legacy Vercel production dependencies/status integrations are retired without breaking rollback evidence.
12. GitHub `main` release governance / required checks are enabled before merge/promotion.
13. A controlled promotion and rollback procedure is established and exercised without DNS ambiguity.

### Prohibited while verdict is NO-GO

- Do not merge the candidate into `main` for production release.
- Do not change production DNS.
- Do not retarget a live Stripe webhook.
- Do not substitute another product's Stripe account.
- Do not perform an uncontrolled real-money payment.
- Do not expose secret values in logs or documentation.
- Do not treat a preview Worker as production merely because it responds successfully.

The code-side candidate has passed the full matrix at the last runtime-changing head. Production remains locked until the exact current head and external production gate matrix are independently green.
