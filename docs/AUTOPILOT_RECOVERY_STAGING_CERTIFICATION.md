# Titan Autopilot — Recovery Staging Certification

## Purpose

Titan Autopilot must be certified against the recovered TitanOS schema before production enablement.

The current Titan data architecture has two separate Supabase roles:

- `xcfjpxcmokdfwkarwomy` — current Attention-only project. Do **not** apply Titan Autopilot migrations here.
- `wbymywwrpbljfbsemung` — **TitanOS Recovery Staging**. This project contains the recovered TitanOS operational schema and is the certification target for Autopilot.

This document records the verified staging contract. It is not authorization to promote the staging database to production.

## Verified Recovery Staging prerequisites

Read-only inspection confirmed:

- `auth.users` and `gen_random_uuid()` exist;
- `public.customers` contains `id`, `created_by_id`, and `email`;
- `public.invoices` contains `customer_id`, owner, balance, due-date, and status fields;
- `public.payments` and `public.follow_up_queue` exist;
- `public.stripe_webhook_events` already exists with the canonical event-id primary-key ledger.

The recovered project does **not** need historical migration `018_stripe_webhook_idempotency.sql` replayed merely to satisfy a filename assumption. The prerequisite is the verified canonical ledger shape.

Recovery Staging also intentionally does not contain the optional historical Founding-100 schema (`public.platform_launch` and `profiles.founding_*`). Signup/confirmation hardening must therefore treat Founding as optional and never make Auth confirmation depend on those tables existing.

## Required Recovery Staging migration order

Apply only to the recovered TitanOS operational database, in this order:

1. `supabase/migrations/041_titan_autopilot.sql`
2. `supabase/migrations/042_autopilot_membership_claims.sql`
3. `supabase/migrations/20260914130000_autopilot_delivery_idempotency.sql`
4. `supabase/migrations/20260914193000_autopilot_funnel_events.sql`
5. `supabase/migrations/20260914194500_autopilot_queue_rls.sql`
6. `supabase/migrations/20260914203000_stripe_webhook_claim_state.sql`
7. `supabase/migrations/20260914210000_autopilot_recipient_snapshot.sql`
8. `supabase/migrations/20260914211500_restore_durable_rate_limit_backend.sql`
9. `supabase/migrations/20260915024500_founding_claim_requires_verified_auth.sql`
10. `supabase/migrations/20260915025000_founding_claim_optional_schema_guard.sql`

The first seven implement the Autopilot product contract. The eighth restores Titan's service-role-only durable rate-limit fallback for recovered environments. The final two prevent unverified users from consuming Founding entitlements when that feature exists and make the claim path a safe `founding_unavailable` no-op when the optional schema is absent.

## Recipient safety contract

Autopilot recipient authorization is intentionally stricter than ordinary follow-up messaging:

1. Invoice recovery email is derived by the database from the invoice owner's customer relationship.
2. A client cannot persist an arbitrary invoice recovery address by writing `customer_email`; the trigger re-resolves it.
3. One-time Checkout persists the exact `invoice_id` + normalized `customer_email` pairs approved before payment.
4. Monthly claims persist the same exact recipient evidence.
5. Execution and retry compare current invoice recipient state with the approved snapshot.
6. A recipient change stops the invoice and requires fresh approval.
7. Legacy/incomplete runs without exact approval evidence fail closed rather than inferring a replacement recipient.

## Signup confirmation contract

Production signup is product-owned rather than dependent on implicit Admin Auth mail behavior:

1. Registration is protected by Titan's durable cross-instance limiter.
2. Supabase admin `generateLink(type: "signup")` creates the unconfirmed user and returns a six-digit signup OTP.
3. Titan sends that OTP through Resend with deterministic provider idempotency.
4. Mail/OTP dependency failures fail closed and do not silently switch confirmation mechanisms.
5. The browser verifies through its persistent Supabase client and preserves the complete refreshable session.
6. Resend requests are bound to the exact pending `userId + email`, use a fresh `magiclink` OTP, and do not automatically fan out across multiple API hosts after an ambiguous network result.
7. An abandoned unconfirmed signup can be recovered only after Supabase validates the original password and returns `email_not_confirmed`.
8. Founding entitlements, when installed, cannot be claimed until email or phone verification is recorded.
9. Missing optional Founding schema must return `founding_unavailable` and must not abort Auth confirmation.

## Service-only data contract

- `autopilot_membership_claims` and `autopilot_funnel_events` revoke client table privileges and have explicit client-deny RLS policies.
- Recovery Receipts remain readable by their owner but authenticated clients cannot insert/update/delete `autopilot_run:*` rows.
- `titan_rate_limit_buckets` is service-role-only with an explicit client-deny RLS policy.
- `consume_rate_limit(text, integer, integer)` is executable only by the service role.

## CI contract

`npm run test:payments` includes:

- `scripts/autopilot-service.test.mjs`
- `scripts/autopilot-recipient-contract.test.mjs`
- `scripts/titanos-runtime-contract.test.mjs`

The runtime contract test gates TitanOS/Attention Supabase isolation, durable signup throttling, product-owned signup OTP generation/resend, abandoned-signup recovery, Product Hunt return-to behavior, workflow surface mapping, verified-only Founding claims, and optional-schema compatibility.

`npm run gate:ship` includes `test:payments`.

## Baseline advisor state

Before Autopilot, Recovery Staging had two unrelated security-advisor INFO findings:

- `public.portal_sessions` — RLS enabled with no policy.
- `public.titan_comms_channel_secrets` — RLS enabled with no policy.

After Autopilot, durable-rate-limit restoration, and signup/Founding compatibility hardening, the security advisor returned to this exact baseline. No Autopilot, rate-limit, signup, or Founding migration security lint remains.

Performance advisor output contains pre-existing unused-index and multiple-permissive-policy findings across the recovered schema. Do not delete indexes solely because staging usage counters are zero.

Supabase remediation references:

- RLS enabled with no policy: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Unused index: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index
- Multiple permissive policies: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies

## Live staging certification requirements

Recovery Staging must demonstrate all of the following before application-level E2E testing:

1. Expected Autopilot columns, tables, constraints, indexes, triggers, and policies exist.
2. Owner can read an `autopilot_run:*` Recovery Receipt.
3. Owner cannot update/delete that receipt or forge a new Autopilot row.
4. Ordinary non-Autopilot Follow-ups remain writable by their owner.
5. Authenticated clients cannot write funnel events or monthly claims directly.
6. Direct client edits to `invoices.customer_email` are re-derived from the owner-matched customer relationship.
7. Durable rate limiter allows requests within the configured limit and blocks the next request with positive retry metadata.
8. Authenticated clients cannot execute `consume_rate_limit` or write its bucket table.
9. Synthetic Auth profile creation works.
10. Email confirmation does not fail when optional Founding schema is absent.
11. Synthetic Auth/profile probe rows are fully cleaned up.
12. Security advisor shows no new Autopilot/rate-limit/signup finding.

These database checks have passed on Recovery Staging; evidence is recorded in `AUTOPILOT_RECOVERY_STAGING_REPORT.md`.

## Remaining non-database blockers

- GitHub Actions quality and Android jobs still terminate before any workflow step executes, so no executable CI result exists for the current head.
- Both linked Vercel projects still report `Account is blocked.`, so no current-branch preview build is available.
- Fresh-account signup OTP delivery/resend/confirmation must still be exercised using actual deployed Supabase/Resend credentials.
- Controlled Stripe + Autopilot Resend application-level execution and mobile/desktop walkthrough remain required after hosting is restored.

Do not merge PR #85 or promote a Product Hunt relaunch while those release-evidence paths are unavailable.
