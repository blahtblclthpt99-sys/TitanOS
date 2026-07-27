# PayPal membership checkout

## What that PEM certificate was

The block you pasted is PayPal’s **public** `live_api` certificate (CN=`live_api`, O=`PayPal Inc.`).

- It is **not** a private key — safe to share publicly.
- It is **not** what modern NCP / REST webhooks use for verification.
- TitanOS verifies webhooks with PayPal’s **`/v1/notifications/verify-webhook-signature`** API instead.
- **Never** paste a PayPal **private** key into chat or commit it to git.

## Live checkout links (already in app)

| Product | Amount | Link |
|---------|--------|------|
| Starter | $4.99 | Update NCP URL in `PAYPAL_CHECKOUT.starter` |
| Pro | $9.99 | Update NCP URL in `PAYPAL_CHECKOUT.worker_premium` |
| Business | $19.99 | Update NCP URL in `PAYPAL_CHECKOUT.business` |

Create matching PayPal No-Code Payment buttons for each amount, then paste the URLs into `src/lib/plan.js`.  
Legacy $29.99 / $49.99 payments still map to Pro / Business for in-flight checkouts.

Marketplace **modules are included** with Pro / Business — there is no $1.99 per-module checkout.

Shown on `/pricing` and Settings → Upgrade. Founding 100: first month free, then locked price.

## Auto-upgrade after payment (webhook)

Endpoint:

`https://titanos-web.vercel.app/api/functions/paypalWebhook`

### Vercel env (Production)

```
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...
PAYPAL_MODE=live
```

### PayPal Developer steps

1. Create a Live REST app → copy Client ID + Secret into Vercel.
2. Webhooks → add the endpoint above.
3. Subscribe at least to: `PAYMENT.CAPTURE.COMPLETED` (also fine: `CHECKOUT.ORDER.APPROVED` / `COMPLETED`).
4. Copy the Webhook ID into `PAYPAL_WEBHOOK_ID`.
5. Apply DB migration `027_paypal_webhook_events.sql`.

### How we match the buyer to a TitanOS account

Payer **email** on the PayPal payment must match `profiles.email` (case-insensitive).  
Amount maps: **$4.99 → starter**, **$9.99 → worker_premium (Pro)**, **$19.99 → business**  
(also accepts legacy **$29.99 → Pro**, **$49.99 → business**).

If emails don’t match, payment succeeds but the account won’t auto-upgrade — an admin can set `plan_tier` / `paying_subscriber` manually.
