# PayPal membership checkout

## What that PEM certificate was

The block you pasted is PayPal’s **public** `live_api` certificate (CN=`live_api`, O=`PayPal Inc.`).

- It is **not** a private key — safe to share publicly.
- It is **not** what modern NCP / REST webhooks use for verification.
- TitanOS verifies webhooks with PayPal’s **`/v1/notifications/verify-webhook-signature`** API instead.
- **Never** paste a PayPal **private** key into chat or commit it to git.

## Live checkout links (in `src/lib/plan.js` → `PAYPAL_CHECKOUT`)

| Product | Amount | Link |
|---------|--------|------|
| Marketplace Modules (all) | $0.99 | `https://www.paypal.com/ncp/payment/USR42PN73VD9N` |
| Starter | $4.99 | `https://www.paypal.com/ncp/payment/TK7HZNKJWAKUL` |
| Pro | $9.99 | `https://www.paypal.com/ncp/payment/Q63SUKNY5AK58` |
| Business | $19.99 | `https://www.paypal.com/ncp/payment/5V47YYFZVCNZ4` |

NCP button amounts in PayPal Dashboard must match. Legacy **$29.99 / $49.99** membership payments still map to Pro / Business for in-flight checkouts — they are **not** used for modules.

**Modules:** one **$0.99** pack unlocks all Marketplace Apps (`marketplace_pack_unlocked`). Also included with Pro / Business. There is no $29.99/mo module plan.

Shown on `/pricing`, Marketplace Apps, and Settings → Upgrade. Founding 100: first month free, then locked price.

## Auto-upgrade after payment (webhook)

Endpoint:

`https://titanos-web.vercel.app/api/functions/paypalWebhook`

Amount maps:

- **$0.99** → Marketplace Modules pack (`marketplace_pack_unlocked`)
- **$4.99** → starter
- **$9.99** → worker_premium (Pro)
- **$19.99** → business
- Legacy **$29.99 → Pro**, **$49.99 → business**, **$1.99 → marketplace pack**

Payer email must match a TitanOS `profiles.email`. Apply migration **038** for the pack unlock column.
