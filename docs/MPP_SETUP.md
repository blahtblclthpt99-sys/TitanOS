# Machine Payments Protocol (MPP) — TitanOS

Endpoint: `POST|GET /api/functions/mppPaid`  
Probe: `HEAD /api/functions/mppPaid` (no Stripe side effects)

Accepts agent / machine payments via:
- **Tempo crypto** (pathUSD / USDC) — default $0.01
- **Stripe SPT** (card + Link) — default $0.50

## Env (Vercel Production)

| Variable | Required | Notes |
|----------|----------|--------|
| `STRIPE_SECRET_KEY` | Yes | Same live/test key you already use |
| `STRIPE_PROFILE_ID` | Yes | Dashboard profile id (`profile_…`) for SPT `networkId` |
| `MPP_SECRET_KEY` | No | ≥32 bytes base64; derived from Stripe key if unset |
| `MPP_TESTNET` | No | Default `1` (testnet). Set `0` for mainnet Tempo token |
| `MPP_TEMPO_AMOUNT` | No | USD string, default `0.01` (capped) |
| `MPP_STRIPE_AMOUNT` | No | USD string, default `0.50` (capped) |
| `MPP_STRICT_CACHE` | No | `1` = reject payTo cache misses (single-instance only) |

## Stripe Dashboard prep

1. [Payment methods](https://dashboard.stripe.com/settings/payment_methods) → enable **Stablecoins and Crypto**
2. [Create a Profile](https://docs.stripe.com/get-started/account/profile) → copy `profile_` id → `STRIPE_PROFILE_ID`
3. Redeploy after setting env

## Smoke test

```bash
# Config probe (no PaymentIntent)
curl -I https://titanos-web.vercel.app/api/functions/mppPaid

# Expect HTTP 402 + WWW-Authenticate Payment challenges
curl -i https://titanos-web.vercel.app/api/functions/mppPaid

# Full crypto round-trip (after mppx account create/fund)
npx mppx https://titanos-web.vercel.app/api/functions/mppPaid
```

## Hardening notes

- Rate limit: 20 req/min/IP (PaymentIntent creation is costly)
- Client errors are sanitized (no secret / PI leakage)
- Deposit address cache is in-memory (5 min TTL). Multi-instance: leave `MPP_STRICT_CACHE` off (default) so Credential reuse works across cold starts; prefer Redis/KV later
- Amounts are clamped server-side

## Code

- `api/functions/mppPaid.js` — compose tempo + stripe charges
- `api/_lib/mppStripe.js` — Stripe client (`2026-03-25.preview`) + `createPayToAddress`
- `scripts/mpp-helpers.test.mjs` — unit tests for validators
