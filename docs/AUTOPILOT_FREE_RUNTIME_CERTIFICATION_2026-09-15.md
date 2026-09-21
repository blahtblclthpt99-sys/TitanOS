# Titan Autopilot — Free Runtime Certification Snapshot

Date: 2026-09-15
Branch: `feature/titan-autopilot-product-hunt`
Target database: TitanOS Recovery Staging (`wbymywwrpbljfbsemung`)

## Scope

This snapshot records live database/runtime evidence for the free Titan Autopilot execution path. It does not certify production hosting, deployed Resend delivery, or visual behavior.

## Verified live on Recovery Staging

### Free-run ledger

- `public.autopilot_runs` exists.
- `anon` and `authenticated` have no direct write privileges.
- service-level synthetic insert succeeds.
- `free_run_started` with `mode=free` is accepted by the coarse funnel schema.
- synthetic run, telemetry, Auth, profile, invoice, and guard probe data was removed or transactionally rolled back.

### Atomic invoice-delivery guard

`claim_autopilot_invoice_delivery` / `release_autopilot_invoice_delivery` were exercised against synthetic owner/invoice records inside rollback-only transactions.

Observed behavior:

1. first owner+invoice claim → `claimed=true`, reason `claimed`;
2. concurrent second run on the same owner+invoice → `claimed=false`, reason `active_reservation`;
3. releasing the first reservation succeeds;
4. a later claim can then acquire the same owner+invoice safely;
5. a Recovery Receipt sent inside the 72-hour safety window blocks a new claim with `recent_sent`;
6. a pending Recovery Receipt inside the provider-safe window blocks a new claim with `pending_delivery`.

These checks prove that separate free runs cannot race through the repeat-reminder gate for the same invoice.

### Recovery Receipt boundary

Previously verified live:

- owner can read Autopilot Recovery Receipts;
- owner cannot update or delete them;
- authenticated clients cannot forge `autopilot_run:*` queue rows;
- ordinary non-Autopilot follow-ups remain writable;
- generic Follow-ups cannot send protected Autopilot rows;
- provider receipt/error columns are present.

### Recipient integrity

Previously verified live:

- invoice `customer_email` is derived from the owner-matched customer relationship;
- direct recipient tampering is re-derived rather than trusted;
- exact approved recipient snapshots are persisted for Autopilot execution;
- recipient drift stops delivery rather than redirecting it.

### Durable rate limiting

Previously verified live:

- database-backed durable limiter exists;
- fixed-window behavior blocks over-limit requests;
- ordinary authenticated clients cannot call or mutate the limiter backend directly.

### Security advisor

Post-migration security advisor returned no new Autopilot findings. The remaining two informational `RLS Enabled No Policy` notices are the known pre-existing service-only `portal_sessions` and `titan_comms_channel_secrets` tables.

The performance advisor reports unused indexes in Recovery Staging, including newly created Autopilot indexes. This is expected on a near-empty staging database before production-like traffic and is not evidence that the indexes are incorrect.

## Current active Autopilot model

- free authenticated access;
- no Autopilot Checkout;
- no one-time price;
- no subscription/plan entitlement;
- no Autopilot Stripe dependency;
- `runAutopilotFree` is the active execution endpoint;
- paid-era endpoints are compatibility tombstones returning HTTP 410;
- Titan Attention payment behavior remains a separate product surface.

## Still required before production certification

- GitHub Actions must actually assign a runner and execute `gate:ship` successfully;
- a deployment from this exact branch/head must build successfully;
- deployed server/client Supabase mapping must point to the intended TitanOS project;
- fresh-account signup OTP initial delivery, resend, verification, persistent session, and `/autopilot` return must pass with deployed credentials;
- a controlled free sprint must complete through Resend and preserve the provider-backed Recovery Receipt;
- ambiguous provider retry behavior must be exercised against deployed runtime credentials;
- public preview, signup/OTP, private Recovery Command Center, and Recovery Receipts must pass mobile + desktop walkthroughs.

Do not merge PR #85 or treat Product Hunt launch readiness as certified until those deployment-level gates pass.
