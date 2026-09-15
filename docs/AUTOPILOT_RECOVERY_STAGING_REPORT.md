# Titan Autopilot — Recovery Staging Certification Report

**Date:** 2026-09-15  
**Target:** TitanOS Recovery Staging (`wbymywwrpbljfbsemung`)  
**Production/Attention project touched:** No  
**PR:** #85 — Titan Autopilot Product Hunt-grade Recovery Command Center

## Result

**Database migration, RLS, recipient-integrity, durable-rate-limit, and signup-confirmation compatibility certification: PASS**

This report does **not** certify production hosting, executable GitHub CI, live Stripe delivery, live Resend delivery with deployment credentials, or Product Hunt launch readiness.

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
9. `20260915024500_founding_claim_requires_verified_auth.sql`
10. `20260915025000_founding_claim_optional_schema_guard.sql`

The first eight implement/recover the Autopilot data/runtime contract. The final two harden signup-adjacent Founding entitlement behavior: a complete Founding-100 installation can claim only after Auth verification, while a recovered environment that does not contain the optional Founding schema returns `founding_unavailable` rather than breaking account confirmation.

An earlier staging remediation also applied explicit client-deny policies to the two service-only Autopilot tables after security linting identified their no-policy deny-by-default state as informational. The branch versions include those policies directly for clean installs.

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
- `trg_auth_user_claim_founding_after_verification`

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

## Signup / Auth confirmation compatibility probe

Recovery Staging does not contain the optional historical Founding-100 schema (`platform_launch` and `profiles.founding_*`). The verified-claim migration was therefore hardened with an optional-schema guard before promotion.

A rollback-only synthetic Auth probe then verified:

- an unconfirmed synthetic Auth user creates the expected TitanOS profile;
- `claim_founding_slot()` returns `founding_unavailable` when the optional Founding schema is absent;
- updating the real Auth state column `email_confirmed_at` succeeds and does not break the confirmation transaction;
- the post-confirm claim path remains a safe `founding_unavailable` no-op in this recovered environment;
- probe cleanup left `0` synthetic Auth rows and `0` synthetic profile rows.

In environments where the complete Founding schema exists, the migration requires `email_confirmed_at` or `phone_confirmed_at` before a scarce slot can be claimed.

## Product-owned signup OTP contract

The branch no longer assumes `admin.createUser()` sends a confirmation message. Production registration now:

- uses Supabase admin `generateLink(type: "signup")` to create an unconfirmed signup and obtain a six-digit `email_otp`;
- delivers that OTP through Titan's Resend path with a deterministic provider idempotency key;
- keeps provider/mail dependency failures fail-closed instead of silently changing confirmation mechanisms;
- verifies the OTP through the persistent browser Supabase client without overwriting its refreshable session;
- owns the resend path via `/api/resendSignupOtp`, bound to the exact pending user and email;
- treats resent codes as `magiclink` OTPs and rejects unexpected verification types;
- recovers abandoned unconfirmed signups only after Supabase password verification returns `email_not_confirmed`.

Live deployment-level email delivery is still a release blocker because current Vercel deployment credentials cannot be exercised while the project is blocked.

## Security advisor result

Before Autopilot, Recovery Staging had two unrelated INFO findings:

- `public.portal_sessions` — RLS enabled, no policy
- `public.titan_comms_channel_secrets` — RLS enabled, no policy

After Autopilot, durable-rate-limit restoration, and the signup/Founding compatibility migrations, the advisor returned to the same two pre-existing findings. **No Autopilot, rate-limit, signup, or Founding migration security lint remains.**

Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Performance advisor result

Pre-existing unused-index and multiple-permissive-policy findings remain throughout the recovered staging schema. No index was removed based only on staging usage counters.

References:

- https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index
- https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies

## Branch regression contract

`npm run test:payments` now includes:

- `scripts/autopilot-service.test.mjs`
- `scripts/autopilot-recipient-contract.test.mjs`
- `scripts/titanos-runtime-contract.test.mjs`

`test:payments` is part of `npm run gate:ship`.

The branch gates:

- server-derived, owner-matched invoice recipient snapshots;
- one-time exact `approved_recipients` evidence;
- monthly exact `recipient_snapshot` preservation;
- changed-recipient stop behavior;
- fail-closed legacy/incomplete approval evidence;
- explicit client-deny policies;
- service-role-only durable rate-limit fallback;
- TitanOS/Attention Supabase project isolation;
- product-owned signup OTP generation/resend/session handling;
- password-proven abandoned-signup recovery;
- verified-only Founding claiming when the optional schema exists;
- safe `founding_unavailable` behavior when it does not.

## Current-head external blockers

Latest head checks still show:

- GitHub quality job: failure before any steps execute (`steps: null`, no logs).
- GitHub Android job: failure before any steps execute (`steps: null`, no logs).
- Vercel `titan-os`: `Account is blocked.`
- Vercel `titanos-web`: `Account is blocked.`

These do not provide application test/build evidence either way.

## Remaining release work

- Restore executable GitHub Actions or obtain an equivalent clean test/typecheck/lint/build result.
- Restore an unblocked current-branch preview/hosting path.
- Run a fresh-account signup OTP + resend + confirmation E2E using deployed Supabase/Resend credentials.
- Run controlled Stripe Checkout/webhook settlement tests against the intended application environment.
- Run controlled Autopilot Resend delivery/idempotency/Recovery Receipt tests.
- Complete mobile + desktop `/autopilot` and Recovery Receipt walkthroughs.

## Promotion decision

**PR #85 stays draft. Do not merge or launch yet.**

The Recovery Staging database/runtime layer is certified for the implemented Autopilot and signup-confirmation compatibility contracts. Remaining blockers are executable CI, hosting/preview, and application-level Auth/Stripe/Resend/UI certification.
