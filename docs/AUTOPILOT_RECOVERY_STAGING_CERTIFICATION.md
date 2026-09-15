# Titan Autopilot — Recovery Staging Certification

## Purpose

Titan Autopilot must be certified against the recovered TitanOS schema before any production enablement.

The current Titan data architecture has two separate Supabase roles:

- `xcfjpxcmokdfwkarwomy` — current Attention-only project. Do **not** apply Titan Autopilot migrations here.
- `wbymywwrpbljfbsemung` — **TitanOS Recovery Staging**. This project contains the recovered TitanOS operational schema and is the certification target for Autopilot.

This document records the verified pre-migration state and the exact staging gate. It is not authorization to promote the staging database to production.

## Verified Recovery Staging prerequisites

Read-only inspection on 2026-09-14 confirmed:

- `auth.users` exists;
- `gen_random_uuid()` exists;
- `public.customers` exists with `id`, `created_by_id`, and `email`;
- `public.invoices` exists with `customer_id`, `created_by_id`, balance/due/status fields, but no `customer_email` yet;
- `public.payments` exists;
- `public.follow_up_queue` exists and currently has the legacy `follow_queue_own` authenticated policy;
- `public.stripe_webhook_events` exists with `event_id` primary-key idempotency, `event_type`, `processed_at`, `payment_id`, and `payload_summary`;
- no Autopilot-specific recipient/provider/funnel/claim-state indexes or columns are present yet.

The recovered project does **not** need migration `018_stripe_webhook_idempotency.sql` to be replayed merely to satisfy a filename/history assumption. Its canonical `stripe_webhook_events` table already exists with the required base shape. The release prerequisite is the verified schema, not the historical migration filename.

## Required Autopilot migration order on Recovery Staging

Apply only to `wbymywwrpbljfbsemung`, in this order:

1. `supabase/migrations/041_titan_autopilot.sql`
   - adds `follow_up_queue.customer_email`
   - adds owner/status/schedule index
2. `supabase/migrations/042_autopilot_membership_claims.sql`
   - creates one monthly claim per user/period
   - keeps claims service-role managed
3. `supabase/migrations/20260914130000_autopilot_delivery_idempotency.sql`
   - provider receipt/error fields
   - one audited `autopilot_run:*` row per owner/delivery key
4. `supabase/migrations/20260914193000_autopilot_funnel_events.sql`
   - privacy-minimized activation telemetry
5. `supabase/migrations/20260914194500_autopilot_queue_rls.sql`
   - replaces legacy `follow_queue_own`
   - owners retain read access to Recovery Receipts
   - authenticated clients cannot insert/update/delete `autopilot_run:*` rows
6. `supabase/migrations/20260914203000_stripe_webhook_claim_state.sql`
   - extends the existing canonical Stripe ledger with retry-safe processing leases
7. `supabase/migrations/20260914210000_autopilot_recipient_snapshot.sql`
   - adds server-derived `invoices.customer_email`
   - backfills only from owner-matched `customers`
   - re-derives customer email on invoice insert or any direct customer/owner/email update
   - adds exact monthly `recipient_snapshot` approval evidence

## Recipient safety contract

Autopilot recipient authorization is intentionally stricter than ordinary follow-up messaging:

1. The invoice recipient snapshot is derived by the database from the invoice owner's customer relationship.
2. A client cannot persist an arbitrary invoice recovery address by writing `customer_email` directly; the trigger re-resolves it.
3. One-time Checkout persists the exact `invoice_id` + normalized `customer_email` pairs approved before payment.
4. Monthly claims persist the same exact recipient evidence.
5. Execution and retry compare current invoice recipient state with the approved snapshot.
6. If the recipient changed, Titan stops that invoice and requires fresh approval.
7. Legacy/incomplete runs without exact recipient evidence fail closed rather than inferring a replacement address.

## CI contract

`npm run test:payments` now includes:

- `scripts/autopilot-service.test.mjs`
- `scripts/autopilot-recipient-contract.test.mjs`

The recipient contract test statically gates owner-matched backfill, server-derived snapshotting, one-time approval evidence, monthly approval evidence, changed-recipient stops, and the no-inferred-recipient rule.

`npm run gate:ship` includes `test:payments`, so these checks are part of the normal ship gate once GitHub Actions is able to execute jobs again.

## Baseline advisor state before Autopilot migrations

Security advisor baseline:

- INFO: `public.portal_sessions` — RLS enabled with no policy.
- INFO: `public.titan_comms_channel_secrets` — RLS enabled with no policy.

Both are pre-existing and unrelated to Autopilot. Post-migration certification must not introduce a new Autopilot security finding.

Performance advisor baseline contains pre-existing unused-index and multiple-permissive-policy findings across the recovered schema. Do not delete indexes merely because staging usage counters are zero; evaluate them separately with production workload evidence.

Supabase remediation references:

- RLS enabled with no policy: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Unused index: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index
- Multiple permissive policies: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies

## Durable outbound rate-limit prerequisite

Recovery Staging currently does not expose the `consume_rate_limit` RPC. Autopilot migrations themselves do not require it, but production outbound messaging must have at least one durable limiter available before enablement:

- configured `UPSTASH_REDIS_REST_*`, or
- a service-role-only `consume_rate_limit` Supabase RPC.

Do not weaken `requireDurable: true` to work around missing infrastructure.

## Post-migration staging certification

After all seven migrations are applied to Recovery Staging:

1. Re-run Supabase security advisors and confirm no new Autopilot security lint.
2. Re-run performance advisors and record only newly introduced Autopilot findings.
3. Verify all expected columns, constraints, indexes, triggers, and policies exist.
4. Run `node scripts/verify-autopilot-db-security.mjs` against Recovery Staging and require exit 0 / `PASS`.
5. Confirm authenticated owner can read an `autopilot_run:*` Recovery Receipt but cannot update/delete it or forge one.
6. Confirm ordinary non-Autopilot follow-up rows remain writable by their owner.
7. Confirm authenticated client cannot write `autopilot_funnel_events` directly.
8. Confirm direct client edits to `invoices.customer_email` are overwritten from the owner-matched customer relationship.
9. Confirm a customer email change after approval causes `approved_recipient_changed` and no provider request.
10. Confirm old orders/claims lacking exact approval snapshots fail closed with `AUTOPILOT_RECIPIENT_SNAPSHOT_REQUIRED`.
11. Confirm the canonical Stripe ledger accepts the new processing/processed/failed columns and unique event replay remains safe.
12. Only after database certification passes, run controlled Stripe + Resend end-to-end tests.

## Current non-database blockers

These remain external to the staging schema:

- GitHub Actions quality and Android jobs are failing before any workflow step executes, including after manual reruns.
- Both linked Vercel project checks currently report `Account is blocked`.

Do not merge PR #85 or promote a Product Hunt relaunch while those release-evidence paths are unavailable.
