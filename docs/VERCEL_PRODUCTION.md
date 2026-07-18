# TitanOS on Vercel — Production Checklist

This maps the Vercel well-architected checklist to TitanOS. Items marked **Repo** are handled in this repository. Items marked **Dashboard** are configured in the [Vercel project settings](https://vercel.com/dashboard).

---

## Operational excellence

| Item | Status | Action |
|------|--------|--------|
| Incident response plan | **Dashboard** | Document escalation paths, comms channel (#incidents), and rollback steps below |
| Stage / promote / rollback | **Dashboard** | Use Preview → Production promotion in Vercel; rollback via Deployments → ⋮ → Promote previous |
| Monorepo build caching | **N/A** | Single-package Vite app — `npm ci` + Vercel dependency cache is sufficient |
| Zero-downtime DNS migration | **Dashboard** | Add domain → verify → lower TTL → switch nameservers to Vercel DNS → monitor |

### Incident response (template)

1. **Detect** — Vercel deployment failure, user reports, or monitoring alert
2. **Triage** — Check Vercel deployment logs and Base44 API status
3. **Communicate** — Post in team channel; status page if customer-facing
4. **Mitigate** — Roll back deployment in Vercel, or revert git commit and redeploy
5. **Resolve** — Fix forward on a branch; validate on Preview before Production promote
6. **Post-mortem** — Document cause, timeline, and prevention within 48 hours

### Rollback

```text
Vercel Dashboard → Project → Deployments → select last good deployment → Promote to Production
```

Or redeploy a known-good git tag from the Deployments tab.

---

## Security

| Item | Status | Action |
|------|--------|--------|
| CSP + security headers | **Repo** | `vercel.json` sets CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy |
| Deployment Protection | **Dashboard** | Settings → Deployment Protection → enable for Preview (and Production if internal) |
| WAF | **Dashboard** | Settings → Firewall → enable managed rulesets; add bot-block rule (see below) |
| Log Drains | **Dashboard** | Settings → Log Drains → connect Datadog / Axiom / custom endpoint |
| SSL certificate issues | **Dashboard** | Settings → Domains → verify DNS records; see [Vercel SSL docs](https://vercel.com/docs/domains/troubleshooting) |
| Preview Deployment Suffix | **Dashboard** | Settings → Domains → Preview Deployment Suffix (Pro+) |
| Commit lockfiles | **Repo** | `package-lock.json` is committed; builds use `npm ci` |
| Rate limiting | **Dashboard** | WAF custom rule or `@vercel/firewall` if you add Edge Middleware later |
| Team access roles | **Dashboard** | Settings → Team → Members → assign Viewer / Developer / Admin |
| SAML SSO | **Dashboard** | Pro+ / Enterprise — Team Settings → Security |
| SCIM | **Dashboard** | Enterprise — Team Settings → Directory Sync |
| Audit Logs | **Dashboard** | Enterprise — Team Settings → Audit Log |
| Cookie policy | **Dashboard** | Enterprise — restrict deployment cookies if required |
| Block unwanted bots | **Dashboard** | Firewall → Add Rule → Block known bots / custom User-Agent patterns |

### WAF bot-block rule (example)

In Vercel Firewall, create a rule:

- **Condition:** User-Agent contains `bot` OR `crawler` OR `spider` (tune for your traffic)
- **Action:** Challenge or Block
- **Exclude:** Verified search engines you want (Googlebot, Bingbot) via managed ruleset allowlist

### Environment variables (Vercel)

Set in Project → Settings → Environment Variables:

| Variable | Environments |
|----------|----------------|
| `VITE_TITANOS_APP_ID` | Production, Preview |
| `VITE_TITANOS_API_URL` | Production, Preview |

If `VITE_TITANOS_API_URL` differs from `https://base44.app`, update the `/api` rewrite destination in `vercel.json` to match.

---

## Reliability

| Item | Status | Action |
|------|--------|--------|
| Observability Plus | **Dashboard** | Pro+ — Observability tab for errors, traffic, latency |
| Function failover | **N/A** | No Vercel Functions; API runs on Base44 |
| Secure Compute failover | **N/A** | Not used |
| Static asset caching | **Repo** | `vercel.json` — `/assets/*` immutable 1-year cache |
| ISR | **N/A** | Vite SPA, not Next.js |
| Distributed tracing | **Optional** | Add OpenTelemetry later if you introduce Edge/Serverless routes |
| Load testing | **Dashboard** | Enterprise load tests, or run k6/Locust against Preview URL |

---

## Performance efficiency

| Item | Status | Action |
|------|--------|--------|
| Speed Insights | **Optional** | Add `@vercel/speed-insights` to `src/main.jsx` (see below) |
| TTFB | **Monitor** | Use Speed Insights + Vercel Observability; keep API region close to users |
| Image Optimization | **Partial** | Prefer WebP/AVIF in `public/`; large media → Vercel Blob or CDN |
| Script optimization | **Repo** | Vite code-splits routes; review large chunks in build output |
| Font optimization | **Future** | Self-host Inter via `@fontsource/inter` to remove Google Fonts CSP exception |
| Function region | **N/A** | No Vercel Functions |
| Third-party proxy | **N/A** | Avoid Cloudflare-in-front-of-Vercel unless coordinated with Vercel support |

### Optional: Speed Insights

```bash
npm install @vercel/speed-insights
```

```jsx
// src/main.jsx
import { injectSpeedInsights } from '@vercel/speed-insights';
injectSpeedInsights();
```

---

## Cost optimization

| Item | Status | Action |
|------|--------|--------|
| Fluid compute | **N/A** | No Vercel Functions |
| Usage guides | **Dashboard** | [Manage and optimize usage](https://vercel.com/docs/pricing/manage-and-optimize-usage) |
| Spend Management | **Dashboard** | Team Settings → Billing → Spend Management → set alerts |
| Function duration/memory | **N/A** | No Vercel Functions |
| ISR revalidation | **N/A** | Vite SPA |
| Image optimization pricing | **Dashboard** | Teams before Feb 18, 2025 — opt into new pricing in Billing |
| Large media → Blob | **Recommended** | Move APK, videos, GIFs to Vercel Blob or external CDN; link via `VITE_TITANOS_APK_URL` |

---

## "Domain is not valid" (Base44)

This JSON error comes from **Base44**, not Vercel:

```json
{"error_type":"HTTPException","message":"Domain is not valid","detail":"Domain is not valid"}
```

### If you are adding a domain in Base44 Dashboard → Domains

Base44 **Domains** is for apps **hosted on Base44** (DNS points to `base44.onrender.com`). TitanOS frontend on **Vercel** uses Vercel DNS instead — do not add your Vercel URL there unless you are moving hosting to Base44.

When connecting a domain in Base44, use **only the hostname**:

| Wrong | Correct |
|-------|---------|
| `https://app.example.com` | `app.example.com` |
| `app.example.com/` | `app.example.com` |
| `*.vercel.app` | Not supported (no wildcards) |
| `localhost` | Not supported |

### If Google login fails on `titanos1.vercel.app`

OAuth flow:

1. You click Google login on `https://titanos1.vercel.app`
2. Google succeeds and hits `https://app.base44.com/api/apps/auth/callback`
3. Base44 reads `domain` / `from_url` from state and must allow that host
4. If not allowlisted → `Domain is not valid` (callback never returns you to Vercel)

**`*.vercel.app` is not automatically allowlisted by Base44.** Pick one:

| Option | What to do |
|--------|------------|
| **A. Email login (now)** | Use email + password on `/login` — no Google OAuth domain check |
| **B. Custom domain (best)** | Add `app.yourdomain.com` on Vercel, set `VITE_TITANOS_PUBLIC_ORIGIN`, connect same host in Base44 Domains (or ask Base44 support to allowlist it) |
| **C. Base44 hosting** | `npm run build` then `npx base44 site deploy` — use your `*.base44.app` URL; Google login works there |
| **D. Support ticket** | Ask Base44 to allowlist `titanos1.vercel.app` for app `6a40a4487d932972c860f13e` |

Vercel env (already required):

```
VITE_TITANOS_PUBLIC_ORIGIN=https://titanos1.vercel.app
```

After code deploy, login also sends `domain=titanos1.vercel.app` (hostname only) which may help if Base44 was rejecting the `https://` form in state.

---

## Deploy steps

1. Push repo to GitHub/GitLab/Bitbucket
2. Import project in Vercel (framework: Vite — auto-detected)
3. Set environment variables
4. Deploy Preview → smoke test `/login`, `/pricing`, API calls
5. Add custom domain → enable Vercel DNS
6. Enable Deployment Protection + WAF
7. Promote Preview to Production

---

## DNS migration (zero downtime)

1. Add domain in Vercel → copy required DNS records
2. Lower TTL on old DNS to 300s (24–48 hours before cutover)
3. Add Vercel records alongside existing records (don't delete old yet)
4. Verify SSL certificate issued in Vercel
5. Switch nameservers to Vercel DNS (or update A/CNAME at registrar)
6. Monitor traffic for 24 hours; remove old DNS entries
