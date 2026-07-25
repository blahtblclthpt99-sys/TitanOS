# TitanOS Stripe integration plan

**Business:** https://titanos-web.vercel.app  
**Model:** Phone/field-service app selling services (one-time payments + invoicing)  
**Products needed:** Payments, Invoicing  

> Generated after Stripe plugin/MCP were unavailable in this Cursor session.  
> Stripe skills installed from https://docs.stripe.com.  
> Review against existing TitanOS code + Stripe best practices (Checkout Sessions).

---

## Recommended architecture (best practice)

| Need | Stripe product | Why |
|------|----------------|-----|
| Collect payment in app / portal | **Checkout Sessions** (hosted) | PCI-light, mobile-friendly, dynamic payment methods |
| TitanOS invoices (already in Supabase) | Checkout linked to invoice `metadata` | Keep TitanOS as source of truth; Stripe settles money |
| Optional later: Stripe-hosted invoices | **Stripe Invoicing API** | Email invoices from Stripe; sync status via webhooks |
| Worker marketplace payouts (future) | **Connect** | Not required for “sell my service” MVP |

**Do not use:** Charges API, Sources, Card Element, client-trusted “mark paid”.

---

## What TitanOS already has (good)

| Piece | Location | Status vs plan |
|-------|----------|----------------|
| Checkout Sessions for collect payment | `api/functions/createPaymentLink.js` | Aligns with recommended API |
| Portal invoice checkout | `api/functions/portalPayInvoice.js` | Correct pattern; webhook marks paid |
| Webhook signature verify + idempotency | `api/functions/stripeWebhook.js` | Required; fail-closed without secret |
| Server-side fees | Fee Engine + `createPaymentLink` | Never trust client fees |
| Client cannot set paid | `paymentsApi.js` + migrations | Correct |
| Secret key on Vercel | Live health `stripeConfigured: true` | Done |

---

## Gaps to close (priority)

### P0 — unblock live settlement (ops)
1. Add **`STRIPE_WEBHOOK_SECRET`** (`whsec_...`) on Vercel Production  
2. Webhook endpoint: `https://titanos-web.vercel.app/api/functions/stripeWebhook`  
3. Events: `checkout.session.completed`, `expired`, `async_payment_failed`, `payment_intent.payment_failed`, `charge.failed`, `charge.refunded`  
4. Redeploy → health must show `webhookConfigured: true`  
5. Stripe Dashboard → Send test event → expect **200**

### P1 — match Stripe best practices in code
1. Prefer official **`stripe` Node SDK** for Checkout create (already used for webhooks); replace raw `fetch` form posts in `createPaymentLink` / `portalPayInvoice` for consistency + API version pinning  
2. Omit hardcoded payment method lists (already omitted — keep it that way for dynamic methods)  
3. Add Checkout `customer_email` when known (portal/customer) for receipts  
4. Consider Stripe Tax later only after tax registrations are active  

### P2 — Invoicing product path
**Two options (pick one):**

**A — Keep TitanOS invoices (current, recommended for now)**  
- Create invoice in app → “Collect payment” → Checkout → webhook sets TitanOS invoice `paid`  
- Pros: already built, fee engine, hire/jobs linked  
- Cons: Stripe Dashboard invoices won’t mirror TitanOS 1:1  

**B — Stripe Invoicing API**  
- Create Stripe Invoice + Invoice Items → finalize → send → webhooks `invoice.paid`  
- Pros: Stripe email/reminders, dunning  
- Cons: new sync layer to TitanOS; more work  

For a phone/service app MVP: **stay on path A**, optionally add Stripe Customer IDs on profiles later.

### P3 — Mobile (Capacitor)
- Checkout already redirects to Stripe-hosted URL (works in Browser plugin)  
- Ensure return URLs use allowlisted `APP_ORIGIN` / `resolveAppOrigin` (already done for createPaymentLink)  
- Set `APP_ORIGIN=https://titanos-web.vercel.app` on Vercel if portal pay needs it  

---

## Key map (never commit)

| Env var | Value looks like | Where |
|---------|------------------|--------|
| `STRIPE_SECRET_KEY` | `sk_test_...` or `sk_live_...` | Vercel (server only) — **already set** |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` only | Vercel — **still missing** |
| `pk_live_...` | Publishable | Optional; TitanOS Checkout doesn’t need it in browser today |
| `APP_ORIGIN` | `https://titanos-web.vercel.app` | Vercel optional |

---

## Test plan

1. Health: `stripeConfigured` + `webhookConfigured` both true  
2. App → Payments → create link → pay with Stripe test card `4242…` (test mode) or live card (live mode)  
3. Webhook delivery **200**; TitanOS payment `succeeded`; invoice `paid` if linked  
4. Cancel/expire session → status canceled, not paid  

---

## Enable Stripe MCP in Cursor (for planner tools next session)

1. Click: [Install Stripe MCP in Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=stripe&config=eyJ1cmwiOiJodHRwczovL21jcC5zdHJpcGUuY29tIn0%3D)  
   Or use `~/.cursor/mcp.json` (already written with `https://mcp.stripe.com`).  
2. Restart Cursor / reload MCP → authenticate with Stripe OAuth when prompted.  
3. Confirm tool `stripe_implementation_planner` appears, then re-ask for a live plan.

Claude Code plugin (`claude plugin install stripe@…`) is **not** available here — Cursor doesn’t ship the `claude` CLI.
