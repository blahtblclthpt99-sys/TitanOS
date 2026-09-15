# Titan Autopilot revenue launch

## Sellable service

**Invoice Recovery Sprint — $9 one-time**

- A signed-in business selects up to 10 overdue, unpaid invoices with server-derived customer email snapshots.
- A sprint allows only **one invoice per normalized customer email**.
- Checkout persists the exact approved `invoice_id + customer_email` recipient snapshot before payment.
- The configured Stripe Price is verified server-side as active, one-time, USD, and exactly $9.00 before Checkout is created.
- Stripe Checkout collects payment; only a verified settled webhook unlocks execution.
- Returning from Stripe is not settlement evidence by itself.
- Titan rechecks invoice eligibility and approved-recipient consistency immediately before delivery.
- An invoice that became paid/no-longer-due is stopped.
- A recipient that changed after approval is stopped and requires fresh approval; Titan never invents a replacement address.
- Titan sends one factual payment reminder per approved customer through Resend.
- Provider requests use deterministic Resend idempotency keys.
- Ambiguous provider/network outcomes remain `pending` and retryable only inside the provider-safe window.
- Provider message IDs and normalized delivery errors are preserved in `follow_up_queue`.
- Autopilot Recovery Receipts are read-only to ordinary authenticated clients; service-role runners own mutation/reconciliation.
- Paid orders and monthly sprints use compare-and-set execution leases.
- Monthly recovery preserves its original approved invoice/recipient snapshot.
- Legacy batches reserve customers already represented by non-skipped recovery evidence and stop later duplicate-customer invoices.
- Autopilot Stripe events use Titan's canonical webhook ledger with retryable `processing → processed/failed` leases.
- Stripe product routing isolates TitanOS/Autopilot from Titan Attention before either product database is opened.

This is a concrete follow-up service deliverable, not advertising revenue and not a guarantee of collection.

## Sandbox catalog

- Product: `prod_UzvOMcH0CcJcIK`
- Price: `price_1TzvXZIMo997dzoAgcgt4Br1` ($9 USD)
- Account: `titanos sandbox`
- Set `STRIPE_AUTOPILOT_PRICE_ID` to the sandbox price only on sandbox/preview environments that use the matching Stripe account.

Never combine a sandbox price ID with a live secret key. The live deployment must use a matching live product/price reviewed for the intended account.

## Recovery-compatible database order

**Prerequisite:** the canonical `public.stripe_webhook_events` base schema exists with its event primary key and required base columns. Do not replay a historical migration merely because migration `018` is absent from recovered migration history when the canonical schema is already present.

Apply in this order for a recovered TitanOS environment:

1. `supabase/migrations/041_titan_autopilot.sql`
2. `supabase/migrations/042_autopilot_membership_claims.sql`
3. `supabase/migrations/20260914130000_autopilot_delivery_idempotency.sql`
   - provider receipt/error fields
   - one queue record per deterministic Autopilot delivery target
4. `supabase/migrations/20260914193000_autopilot_funnel_events.sql`
   - privacy-minimized first-party activation telemetry
   - explicit client-deny policy
5. `supabase/migrations/20260914194500_autopilot_queue_rls.sql`
   - owners retain Recovery Receipt read access
   - generic client insert/update/delete is blocked for `autopilot_run:*`
6. `supabase/migrations/20260914203000_stripe_webhook_claim_state.sql`
   - processing/processed/failed lifecycle, leases, attempts, last-error evidence
7. `supabase/migrations/20260914210000_autopilot_recipient_snapshot.sql`
   - server-derived `invoices.customer_email`
   - owner-matched historical backfill
   - direct customer-email override re-derivation
   - monthly exact recipient snapshot
8. `supabase/migrations/20260914211500_restore_durable_rate_limit_backend.sql`
   - service-role-only durable fallback for recovered environments missing the historical limiter
9. `supabase/migrations/20260915024500_founding_claim_requires_verified_auth.sql`
   - scarce Founding claims require verified Auth when the optional Founding schema exists
   - Auth verification transition owns the trusted claim path
10. `supabase/migrations/20260915025000_founding_claim_optional_schema_guard.sql`
   - recovered environments without the optional Founding schema return `founding_unavailable` instead of breaking confirmation

Recovery Staging (`wbymywwrpbljfbsemung`) has already passed the Autopilot database/RLS/runtime probes plus synthetic Auth/profile confirmation compatibility. That PASS is not a substitute for production host/Auth/Stripe/Resend certification.

## Required runtime product mapping

TitanOS and Titan Attention are separate products sharing one repository. They must not share an operational database accidentally.

### TitanOS / Autopilot

- intended host/project: `titanos-web`;
- `VITE_APP_SURFACE=titanos` preferred;
- `VITE_SUPABASE_URL` + publishable key must point at the intended TitanOS database;
- `TITAN_STRIPE_WEBHOOK_PRODUCT=autopilot` preferred;
- `SUPABASE_URL` + service-role key used by server functions must point at the same intended TitanOS server database;
- canonical `SUPABASE_URL` and `VITE_SUPABASE_URL` project refs must agree before service-role client creation;
- `VITE_AUTOPILOT_ONETIME_CHECKOUT=true` only when the one-time $9 offer is intentionally enabled;
- production registration must use the Titan server route; direct `supabase.auth.signUp()` fallback is development-only.

### Titan Attention

- intended host/project: `titan-os`;
- `VITE_APP_SURFACE=attention` preferred;
- its Supabase environment must remain on the Attention schema;
- `TITAN_STRIPE_WEBHOOK_PRODUCT=attention` preferred.

Do not launch if these mappings are inferred only from old deployment history; verify the active deployment environment.

## Signup / Auth boundary

Product Hunt onboarding is part of revenue readiness because a buyer cannot reach the Recovery Command Center if signup is unreliable.

Required production behavior:

1. `/api/register` uses durable cross-instance throttling and fails closed when that protection is unavailable.
2. Production registration uses Supabase admin `generateLink(type: "signup")` to create the unconfirmed account and obtain a six-digit `email_otp`.
3. Titan sends that OTP through Resend with a deterministic provider idempotency key.
4. Product-owned mail/OTP failures do not switch the user to a second confirmation mechanism.
5. Browser verification preserves the refreshable Supabase session established by `verifyOtp()`.
6. `/api/resendSignupOtp` is bound to the exact pending `userId + email` and generates a fresh `magiclink` OTP.
7. Automatic client retries do not fan resend requests across multiple API hosts.
8. A previously abandoned unconfirmed signup is recoverable only after the submitted password is validated by Supabase and Auth reports `email_not_confirmed`.
9. Duplicate-account registration responses remain neutral enough not to serve as a high-signal email-enumeration oracle.
10. Confirm-required users do not consume optional Founding entitlements before Auth verification.

## Stripe webhook boundary

`api/functions/stripeWebhook.js` is the only public shared Stripe webhook route.

Required behavior:

1. verify the Stripe signature before product classification;
2. classify Autopilot only from `task_type=invoice_recovery_sprint`;
3. classify Attention only from `kind=attention_campaign_funding`;
4. acknowledge unclassified signed events without touching Supabase;
5. acknowledge cross-product events as scope mismatches without touching the wrong database;
6. delegate matching events to the private `api/_lib/stripeWebhookProductHandler.js` implementation.

Never place the private product handler under `api/functions/`, because that would expose a second public route capable of bypassing the product router.

## Required production configuration

1. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_AUTOPILOT_PRICE_ID` on the TitanOS host.
2. Set `TITAN_STRIPE_WEBHOOK_PRODUCT=autopilot` on TitanOS server functions.
3. Set `RESEND_API_KEY` and a verified `RESEND_FROM` sender/domain. These credentials serve both signup verification and Autopilot transactional delivery.
4. Set TitanOS server/client Supabase values to the same intended project; canonical project-ref mismatch must fail closed.
5. Keep a durable rate-limit backend available. Recovery Staging includes the service-role-only `consume_rate_limit` fallback; Upstash can also satisfy this contract. Do not weaken `requireDurable: true`.
6. Production `/api/register` must use a non-fallback durable-protection failure status so the browser cannot bypass the limiter through hosted Supabase signup.
7. Subscribe the intended Autopilot Stripe endpoint to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
8. Confirm the live Autopilot Price is active, one-time, USD, exactly $9.00, and belongs to the same Stripe account as the secret key/webhook.
9. Configure the Attention deployment separately if Attention is enabled; do not reuse TitanOS database credentials.

## Live database security certification

Run against the exact target TitanOS project:

```bash
node scripts/verify-autopilot-db-security.mjs
```

Require exit `0` / `PASS`. The verifier must demonstrate:

- owner Recovery Receipt read access;
- Recovery Receipt update/delete denial;
- forged `autopilot_run:*` insertion denial;
- ordinary non-Autopilot Follow-up compatibility;
- telemetry schema presence;
- direct client telemetry writes blocked.

The Recovery Staging manual probes additionally demonstrated recipient re-derivation, service-table client denial, durable limiter behavior/client denial, auth-user → profile creation, and email-confirmation compatibility with optional Founding schema absent.

## End-to-end certification sequence

1. Verify the canonical `stripe_webhook_events` base schema on the target database and all ten recovery migrations/capabilities.
2. Run `node scripts/verify-autopilot-db-security.mjs` and require `PASS`.
3. Verify `/autopilot` anonymous traffic loads the lightweight public preview without private invoice/API imports.
4. Create a fresh Product Hunt-style account and confirm the initial six-digit Titan-owned OTP is delivered by the deployed Resend credentials.
5. Verify the code through the browser and prove the resulting session is refreshable and returns the user to `/autopilot`.
6. Repeat with **Resend Code** and prove the new `magiclink` OTP is bound to the same pending account and the prior code is not treated as current.
7. Abandon an unconfirmed signup, retry it with the correct password, and prove a fresh recovery OTP is issued; retry with a wrong password and prove no recovery occurs.
8. Force the durable limiter backend unavailable in a controlled preview and prove production registration fails closed rather than calling direct `supabase.auth.signUp()`.
9. Verify signed-in `/autopilot` enters `AuthenticatedShell`/`TabStack` and the private Recovery Command Center.
10. Verify the current TitanOS deployment points at the intended TitanOS database and not the Attention-only project.
11. Send an unclassified signed Stripe test event and prove neither product ledger is touched.
12. Send an Attention-marked event to the TitanOS deployment and prove it is ignored as a scope mismatch without Attention-table access.
13. Send an Autopilot-marked event to the Attention deployment and prove the symmetrical scope mismatch.
14. Run a controlled Autopilot Checkout and confirm `payments.status = succeeded` only after Stripe reports `payment_status = paid`.
15. Confirm returning from Checkout before webhook settlement cannot execute the order.
16. Verify processed Stripe replay has no duplicate side effect.
17. Force an Autopilot Stripe event to `failed`, replay it, and confirm reclaim increments `attempt_count`, revalidates local state, and commits `processed` only after success.
18. Seed a stale `processing` claim older than the lease and confirm reclaim works; a fresh claim must not receive a false processed acknowledgement.
19. Force a stale local payment/order mutation between validation and settlement and confirm the compare-and-set guard refuses it.
20. Attempt a batch containing two invoices with the same normalized customer email and confirm UI + backend rejection.
21. Run a sprint and confirm successful Recovery Receipt fields include `status=sent`, `sent_at`, and provider message ID.
22. Force an ambiguous provider/network outcome and confirm `pending` + delivery error evidence + retryable HTTP `202`.
23. Retry inside the provider-safe idempotency window and confirm the same deterministic key is reused.
24. Retry after that window and confirm fail-closed behavior.
25. Start the same sprint concurrently and confirm one lease wins while the other reconciles persisted queue truth.
26. Force queue uniqueness contention and confirm the runner re-reads authoritative state.
27. Force provider acceptance while stale local state says failed and confirm reconciliation to `sent` without another provider request.
28. Mark an approved invoice paid before delivery and confirm stop/skip with no provider request.
29. Change an approved customer's email before delivery and confirm `approved_recipient_changed`, no replacement inference, and no provider request.
30. Recover an interrupted monthly sprint after changing current UI selection and confirm the original invoice + recipient snapshot remains authoritative.
31. Exercise a legacy duplicate-customer order/claim and confirm existing recovery evidence reserves the customer while later duplicates stop.
32. Open Follow-ups and confirm Autopilot rows appear only as read-only Recovery Receipts.
33. Call generic `sendFollowUp` with an Autopilot queue ID and confirm `AUTOPILOT_QUEUE_PROTECTED` before Resend.
34. Double-trigger an ordinary pending Follow-up and confirm its deterministic provider key prevents duplicate delivery.
35. Confirm funnel telemetry contains only allow-listed coarse metadata.
36. Perform mobile + desktop walkthroughs on the **current branch deployment**, not a stale deployment from another branch.

## Honest operating rules

- No purchased email lists or cold bulk email.
- Only the authenticated invoice owner can select recipients.
- One sprint contacts each normalized customer email at most once.
- Recipient authorization is snapshotted and cannot silently follow a later email change.
- Amount, invoice number, and due date come from the user's owned records.
- Provider acceptance is not called auditable unless receipt/status is persisted or reconciled.
- Ambiguous delivery remains pending/retryable; it is never falsely reported as sent or conclusively failed.
- Confirmed provider acceptance is authoritative over stale local failure and must reconcile without another send.
- Recovery Receipts cannot be manually resent, marked sent, or deleted through generic Follow-ups.
- Generic queued email uses deterministic provider idempotency and durable production rate limiting.
- Production signup has one authoritative server path and does not silently fall back to hosted Supabase signup.
- Signup verification does not consume a Founding entitlement until Auth verification is recorded.
- Autopilot Stripe events are not processed outside their deployment product scope.
- Autopilot Stripe events are not acknowledged as processed until their exact claim lease commits.
- Failed/stale claims may be reclaimed; fresh concurrent claims must not be falsely acknowledged as complete.
- Funnel telemetry is diagnostic only and must never block checkout/execution.
- Refunds and customer disputes remain owner-controlled in Stripe.

## Release gate

Do **not** enable the one-time paid flow or promote a Product Hunt relaunch until all are true:

- GitHub quality checks have **actually executed steps** and `gate:ship` passed; `steps: null` is not test evidence.
- The current branch has a successful preview/production build on the intended host.
- The current `titanos-web` environment/database/product-scope mapping is verified.
- The current `titan-os` Attention mapping is verified separately if Attention remains deployed.
- All ten Recovery-compatible migrations/capabilities are present on the TitanOS database.
- `verify-autopilot-db-security.mjs` passes against the exact target.
- Fresh-account initial OTP, resend, verification, persistent session, and `/autopilot` return E2E pass on deployed credentials.
- Production registration fails closed if durable protection or Titan's server signup path is unavailable; no hosted-Supabase mechanism switch occurs.
- Stripe product-scope, claim-state replay/recovery, and Checkout settlement tests pass.
- Stripe + Resend live credentials belong to the intended production accounts.
- Controlled provider-idempotency/receipt tests pass.
- Public preview, signup/OTP, private Recovery Command Center, Checkout return, and Recovery Receipts pass mobile + desktop walkthroughs.

## Titan family pattern

Reuse the same **approval → verified settlement/entitlement → atomic execution → provider-idempotent action → immutable evidence** pattern for future Titan programs. Each program should launch with one measurable outcome and verifiable execution evidence before adding more automation types.
