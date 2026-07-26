# Machine Payments Protocol (MPP) — TitanOS

Endpoint: `POST|GET /api/functions/mppPaid`  
Probes: `HEAD` (no side effects) · `GET ?probe=1` (JSON config, no PaymentIntent)

Accepts agent / machine payments via:
- **Tempo crypto** (pathUSD / USDC) — default $0.01
- **Stripe SPT** (card + Link) — default $0.50 (when profile resolves)

## Env (Vercel Production)

| Variable | Required | Notes |
|----------|----------|--------|
| `STRIPE_SECRET_KEY` | Yes | Same live/test key you already use |
| `STRIPE_PROFILE_ID` | No* | `profile_…` for SPT; auto-discovered via Profiles `me` if unset |
| `MPP_SECRET_KEY` | No | ≥32 bytes; derived from Stripe key if unset |
| `MPP_TESTNET` | No | Default `1` (testnet). Set `0` for mainnet Tempo token |
| `MPP_TEMPO_AMOUNT` | No | USD string, default `0.01` (capped) |
| `MPP_STRIPE_AMOUNT` | No | USD string, default `0.50` (capped) |
| `MPP_STRIPE_CURRENCY` | No | Default `usd` (allowlisted) |
| `MPP_STRICT_CACHE` | No | `1` = reject payTo cache misses (single-instance only) |

## Stripe Dashboard prep

1. [Payment methods](https://dashboard.stripe.com/settings/payment_methods) → enable **Stablecoins and Crypto**
2. [Create a Profile](https://docs.stripe.com/get-started/account/profile) → copy `profile_` id → `STRIPE_PROFILE_ID`
3. Redeploy after setting env

## Smoke test

```bash
curl -I https://titanos-web.vercel.app/api/functions/mppPaid
curl "https://titanos-web.vercel.app/api/functions/mppPaid?probe=1"
curl -i https://titanos-web.vercel.app/api/functions/mppPaid
npx mppx https://titanos-web.vercel.app/api/functions/mppPaid
```

## Hardening notes

- Rate limit: 20 req/min/IP
- Body ≤64KB; Authorization ≤8KB
- Deposit PaymentIntents: Idempotency-Key + 15s timeout + metadata
- Profile discovery cached 10 min; amounts/currency clamped
- Expected crypto gaps skip Sentry noise; `X-Request-Id` on responses
- Multi-instance: leave `MPP_STRICT_CACHE` off (default); prefer Redis/KV later

## Code

- `api/functions/mppPaid.js` — compose tempo + optional stripe charges
- `api/_lib/mppStripe.js` — preview Stripe calls + validators
- `scripts/mpp-helpers.test.mjs` — unit tests
