# Titan Autopilot — Recovery Staging Certification Report

**Date:** 2026-09-14  
**Target:** TitanOS Recovery Staging (`wbymywwrpbljfbsemung`)  
**Production/Attention project touched:** No  
**PR:** #85 — Titan Autopilot Product Hunt-grade Recovery Command Center

## Result

**Database migration and RLS certification: PASS**

This report covers database/schema/security behavior only. It does **not** certify production hosting, GitHub CI, live Stripe delivery, Resend delivery, or Product Hunt launch readiness.

## Applied staging migrations

The following Autopilot schema changes were applied successfully to Recovery Staging in order:

1. `041_titan_autopilot.sql`
2. `042_autopilot_membership_claims.sql`
3. `20260914130000_autopilot_delivery_idempotency.sql`
4. `20260914193000_autopilot_funnel_events.sql`
5. `20260914194500_autopilot_queue_rls.sql`
6. `20260914203000_stripe_webhook_claim_state.sql`
7. `20260914210000_autopilot_recipient_snapshot.sql`

During post-migration linting, the two server-only Autopilot tables were reported as `RLS Enabled No Policy` INFO findings. The branch was tightened to include explicit client-deny policies and the same policies were applied to Recovery Staging. The security advisor then returned to its exact pre-Autopilot baseline.

## Schema verification

Verified present after migration:

- `follow_up_queue.customer_email`
- `follow_up_queue.provider_message_id`
- `follow_up_queue.delivery_error_code`
- `idx_followup_autopilot_run_once`
- `idx_followup_provider_message_id`
- `autopilot_membership_claims`
- `autopilot_membership_claims.recipient_snapshot`
- `autopilot_funnel_events`
- `invoices.customer_email`
- `trg_snapshot_invoice_customer_email`
- Stripe ledger fields:
  - `processing_status`
  - `claimed_at`
  - `attempt_count`
  - `last_error`
- `idx_stripe_webhook_events_claim_state`

Verified Follow-up policies:

- `follow_queue_select_own`
- `follow_queue_insert_own_non_autopilot`
- `follow_queue_update_own_non_autopilot`
- `follow_queue_delete_own_non_autopilot`

Verified `autopilot_funnel_events` has no anon/authenticated table grants.

## Live rollback-only RLS / recipient behavior probe

A synthetic auth user, customer, invoice, Recovery Receipt, and ordinary Follow-up were created inside a database transaction, the session switched to the `authenticated` role with the synthetic JWT subject, behavior was tested, and the transaction was rolled back.

All checks passed:

- `receipt_readable = true`
- `receipt_update_blocked = true`
- `receipt_delete_blocked = true`
- `manual_followup_update_allowed = true`
- `direct_recipient_override_rederived = true`

The last check proves a direct authenticated attempt to change `invoices.customer_email` to another address is overwritten by the database trigger with the email from the owner-matched customer relationship.

## Live rollback-only client-write probe

A second synthetic transaction verified:

- `forged_autopilot_insert_blocked = true`
- `funnel_client_write_blocked = true`
- `membership_claim_client_write_blocked = true`

No probe rows or users were persisted.

## Security advisor result

Before Autopilot migrations, Recovery Staging had two unrelated INFO findings:

- `public.portal_sessions` — RLS enabled, no policy
- `public.titan_comms_channel_secrets` — RLS enabled, no policy

After adding explicit deny policies to the two Autopilot server-only tables, the security advisor returned to the same two pre-existing findings. No Autopilot security lint remains.

Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Performance advisor result

The performance advisor continues to report pre-existing unused-index and multiple-permissive-policy findings throughout the recovered staging schema. No index was removed based only on staging usage counters.

References:

- https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index
- https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies

## Recipient approval contract verified in branch

The branch now requires:

- server-derived invoice customer email;
- owner-matched customer relationship;
- one-time `approved_recipients` snapshot before Checkout;
- monthly `recipient_snapshot` preservation;
- exact recipient comparison during new delivery and safe retry;
- `approved_recipient_changed` stop if an email changes after approval;
- `AUTOPILOT_RECIPIENT_SNAPSHOT_REQUIRED` for legacy/incomplete approval evidence;
- no inferred replacement recipient.

`scripts/autopilot-recipient-contract.test.mjs` is included in `npm run test:payments`, which is included in `npm run gate:ship`.

## Remaining staging/runtime blocker

Recovery Staging does not currently expose `public.consume_rate_limit(text, integer, integer)`.

Titan's outbound API protection requires a durable limiter when `requireDurable: true` is used. Before controlled email execution, provide at least one of:

1. valid runtime `UPSTASH_REDIS_REST_*` configuration; or
2. the existing service-role-only `consume_rate_limit` database backend from `20260816231000_durable_rate_limits.sql`.

Do not weaken `requireDurable: true` to bypass this gate.

## Remaining release blockers outside the database

- GitHub Actions jobs still fail before any workflow step executes, including manual reruns.
- Both linked Vercel checks have reported `Account is blocked`.
- No current-branch preview build is available for mobile/desktop walkthrough.
- Live Stripe/Resend end-to-end execution is not yet certified.

## Promotion decision

**PR #85 stays draft. Do not merge or launch yet.**

Database certification has advanced from unverified to PASS on Recovery Staging, but production-grade promotion still requires executable CI, an unblocked host/preview, durable outbound rate limiting, and controlled Stripe + Resend end-to-end certification.
