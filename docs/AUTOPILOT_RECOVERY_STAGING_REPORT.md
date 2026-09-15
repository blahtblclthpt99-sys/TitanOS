# Titan Autopilot — Recovery Staging Certification Report

**Date:** 2026-09-14  
**Target:** TitanOS Recovery Staging (`wbymywwrpbljfbsemung`)  
**Production/Attention project touched:** No  
**PR:** #85 — Titan Autopilot Product Hunt-grade Recovery Command Center

## Result

**Database migration, RLS, recipient-integrity, and durable-rate-limit certification: PASS**

This report does **not** certify production hosting, executable GitHub CI, live Stripe delivery, Resend delivery, or Product Hunt launch readiness.

## Applied Recovery Staging migrations

The following branch migrations were applied successfully:

1. `041_titan_autopilot.sql`
2. `042_autopilot_membership_claims.sql`
3. `20260914130000_autopilot_delivery_idempotency.sql`
4. `20260914193000_autopilot_funnel_events.sql`
5. `20260914194500_autopilot_queue_rls.sql`
6. `20260914203000_stripe_webhook_claim_state.sql`
7. `20260914210000_autopilot_recipient_snapshot.sql`
8. `20260914211500_restore_durable_rate_limit_backend.sql`

An additional staging remediation applied explicit client-deny policies to the two service-only Autopilot tables after security linting identified their earlier no-policy deny-by-default state as informational. The branch versions now include those policies directly for clean installs.

## Verified schema and policy state

Verified after migration:

- `follow_up_queue.customer_email`
- `follow_up_queue.provider_message_id`
- `follow_up_queue.delivery_error_code`
- `idx_followup_autopilot_run_once`
- `idx_followup_provider_message_id`
- `autopilot_membership_claims` + `recipient_snapshot`
- `autopilot_funnel_events`
- `invoices.customer_email`
- `trg_snapshot_invoice_customer_email`
- Stripe ledger fields `processing_status`, `claimed_at`, `attempt_count`, `last_error`
- `idx_stripe_webhook_events_claim_state`
- `titan_rate_limit_buckets`
- `consume_rate_limit(text, integer, integer)`

Verified Follow-up policies:

- `follow_queue_select_own`
- `follow_queue_insert_own_non_autopilot`
- `follow_queue_update_own_non_autopilot`
- `follow_queue_delete_own_non_autopilot`

Autopilot claims, funnel telemetry, and durable rate-limit storage are explicit client-deny surfaces.

## Rollback-only RLS / recipient behavior probe

Synthetic auth/customer/invoice/receipt data was created inside a transaction, tested as the `authenticated` role, and rolled back.

Passed:

- `receipt_readable = true`
- `receipt_update_blocked = true`
- `receipt_delete_blocked = true`
- `manual_followup_update_allowed = true`
- `direct_recipient_override_rederived = true`

The last result proves an authenticated attempt to replace `invoices.customer_email` with another address is overwritten by the database trigger with the owner-matched customer's email.

## Rollback-only client-write probe

Passed:

- `forged_autopilot_insert_blocked = true`
- `funnel_client_write_blocked = true`
- `membership_claim_client_write_blocked = true`

No synthetic users or operational rows were persisted.

## Durable rate-limit live probe

The restored service-role fallback was exercised inside rollback-only probes.

Fixed-window behavior passed:

- `first_allowed = true`
- `second_allowed = true`
- `third_blocked = true` for limit `2`
- `third_retry_after_positive = true`

Client isolation passed:

- direct authenticated function execution blocked;
- direct authenticated rate-limit bucket write blocked.

The application therefore has a durable database fallback for routes that set `requireDurable: true`, independent of optional Upstash configuration.

## Security advisor result

Before Autopilot, Recovery Staging had two unrelated INFO findings:

- `public.portal_sessions` — RLS enabled, no policy
- `public.titan_comms_channel_secrets` — RLS enabled, no policy

After Autopilot hardening and durable-rate-limit restoration, the advisor returned to the same two pre-existing findings. **No Autopilot or rate-limit security lint remains.**

Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Performance advisor result

Pre-existing unused-index and multiple-permissive-policy findings remain throughout the recovered staging schema. No index was removed based only on staging usage counters.

References:

- https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index
- https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies

## Branch regression contract

`scripts/autopilot-recipient-contract.test.mjs` is part of `npm run test:payments`, and `test:payments` is part of `npm run gate:ship`.

The branch gates:

- server-derived, owner-matched invoice recipient snapshots;
- one-time exact `approved_recipients` evidence;
- monthly exact `recipient_snapshot` preservation;
- changed-recipient stop behavior;
- fail-closed legacy/incomplete approval evidence;
- explicit client-deny policies;
- service-role-only durable rate-limit fallback.

## Current-head external blockers

Latest head checks still show:

- GitHub quality job: failure before any steps execute (`steps: null`, no logs).
- GitHub Android job: failure before any steps execute (`steps: null`, no logs).
- Vercel `titan-os`: platform-level failure / blocked account.
- Vercel `titanos-web`: platform-level failure / blocked account.

These do not provide application test/build evidence either way.

## Remaining release work

- Restore executable GitHub Actions or otherwise obtain an equivalent clean CI/build result.
- Restore an unblocked preview/hosting path.
- Run controlled Stripe Checkout/webhook settlement tests against the intended application environment.
- Run controlled Resend delivery/idempotency/receipt tests.
- Complete mobile + desktop `/autopilot` and Recovery Receipt walkthroughs.

## Promotion decision

**PR #85 stays draft. Do not merge or launch yet.**

The Recovery Staging database/runtime layer is now certified for the implemented Autopilot contract. Remaining blockers are CI, hosting/preview, and application-level Stripe/Resend/UI certification.
