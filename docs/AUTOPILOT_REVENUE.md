# Titan Autopilot revenue launch

## Sellable service

**Invoice Recovery Sprint — $9 one-time**

- The signed-in business selects 1–10 overdue, unpaid invoices with customer email addresses.
- A sprint allows only **one invoice per normalized customer email**, so one customer cannot receive several reminders from one approved batch.
- Checkout records the exact approved invoice IDs before payment.
- The configured Stripe Price is verified server-side as active, one-time, USD, and exactly $9.00 before Checkout is created.
- Stripe Checkout collects payment; only a verified, settled webhook unlocks execution.
- The buyer explicitly starts delivery after returning from Checkout.
- TitanOS rechecks each invoice immediately before delivery and stops invoices that are no longer eligible.
- TitanOS sends one factual payment reminder per approved customer through Resend.
- Each provider request uses a deterministic Resend idempotency key so ambiguous network retries do not blindly send a second email.
- Every Autopilot attempt is stored in `follow_up_queue`, including provider message ID or normalized delivery error code when available.
- Autopilot queue rows are read-only to ordinary signed-in clients; the service-role runner owns mutation/reconciliation.
- The paid order and monthly sprint use compare-and-set execution leases so stale workers cannot overwrite a newer recovery attempt.
- Monthly recovery preserves the original approved invoice batch instead of replacing it with a later UI selection.
- Legacy paid orders/monthly claims are normalized deterministically during recovery: an existing non-skipped recovery record reserves that customer and later duplicate-customer invoices are stopped rather than contacted again.
- Autopilot Stripe events use Titan's canonical webhook ledger with retryable `processing → processed/failed` leases; a crash does not become a permanent false duplicate.

This is a real service deliverable, not advertising revenue or a claim that payment is guaranteed.

## Sandbox catalog

- Product: `prod_UzvOMcH0CcJcIK`
- Price: `price_1TzvXZIMo997dzoAgcgt4Br1` ($9 USD)
- Account: `titanos sandbox`
- Set `STRIPE_AUTOPILOT_PRICE_ID` to the sandbox price on preview deployments.

Never use the sandbox price ID with a live secret key. Create a matching live product after owner review and use its live `price_...` ID.

## Required migration order

**Prerequisite:** `supabase/migrations/018_stripe_webhook_idempotency.sql` must already be applied. It creates Titan's canonical `stripe_webhook_events` table used by the hardened Autopilot webhook.

Then apply the Autopilot migrations before enabling the upgraded product paths:

1. `supabase/migrations/041_titan_autopilot.sql`
2. `supabase/migrations/042_autopilot_membership_claims.sql` when the monthly included sprint is enabled
3. `supabase/migrations/20260914130000_autopilot_delivery_idempotency.sql`
   - provider receipt/error fields
   - one queue record per Autopilot recipient target
4. `supabase/migrations/20260914193000_autopilot_funnel_events.sql`
   - privacy-minimized first-party activation telemetry
5. `supabase/migrations/20260914194500_autopilot_queue_rls.sql`
   - signed-in users retain read access to their Recovery Receipts
   - generic client insert/update/delete is blocked for `autopilot_run:*` rows
   - service-role Autopilot execution continues to reconcile those rows
6. `supabase/migrations/20260914203000_stripe_webhook_claim_state.sql`
   - adds `processing`, `processed`, and `failed` lifecycle state to the canonical Stripe event ledger
   - adds claimed-at leases, attempt counters, and last-error evidence
   - preserves historical migration-018 rows as already `processed`

The queue-protection and Stripe claim-state migrations are release requirements, not optional hardening. The generic Follow-ups sender also persists provider receipt fields, so `20260914130000_autopilot_delivery_idempotency.sql` must be applied **before** this branch is enabled.

## Required production configuration

1. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_AUTOPILOT_PRICE_ID` on the production host.
2. Set `RESEND_API_KEY` and a verified `RESEND_FROM` domain.
3. Keep Titan's durable rate-limit backend available (`UPSTASH_REDIS_REST_*` or the service-role-only `consume_rate_limit` Supabase RPC). Outbound generic Follow-ups now fail closed in production when durable protection is unavailable.
4. Subscribe the Stripe webhook endpoint to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
5. Confirm the configured live Autopilot Price is active, one-time, USD, and exactly $9.00. The server deliberately fails closed if it is not.

## Live database security certification

After applying the migrations, run this against the target Supabase project:

```bash
node scripts/verify-autopilot-db-security.mjs
```

The command must exit `0` with `"conclusion": "PASS"`. It creates a temporary confirmed user, exercises the real RLS boundary, cleans up its probe rows/user, and fails closed unless all of these are demonstrated:

- the owner can read an Autopilot Recovery Receipt;
- the authenticated client cannot update that receipt;
- the authenticated client cannot delete that receipt;
- the authenticated client cannot forge an `autopilot_run:*` queue row;
- an ordinary non-Autopilot follow-up still remains writable;
- the `autopilot_funnel_events` schema exists;
- authenticated clients cannot write funnel events directly.

A missing telemetry table is a failure, not a passing access-denied result.

## End-to-end certification sequence

1. Confirm migration 018 exists and `stripe_webhook_events` is readable through the service role, then apply `20260914203000_stripe_webhook_claim_state.sql`.
2. Run `node scripts/verify-autopilot-db-security.mjs` and require `PASS`.
3. Run a live-mode controlled checkout and confirm `payments.status = succeeded` only after Stripe reports `payment_status = paid`.
4. Confirm returning from Checkout before webhook settlement cannot execute the order.
5. Verify an already-`processed` Stripe event is treated as a duplicate without repeating its side effect.
6. Force an Autopilot Stripe event into `failed`, replay it, and confirm Titan reclaims the event, increments `attempt_count`, re-validates the local order, and reaches `processed` only after successful handling.
7. Seed a stale `processing` claim older than the lease and confirm it is reclaimable; a fresh `processing` claim must return non-success with `Retry-After` rather than being acknowledged as processed.
8. Change a local Autopilot payment/order field between webhook validation and settlement and confirm the compare-and-set mutation refuses the stale write so Stripe can retry from a fresh read.
9. Attempt to approve two invoices with the same normalized customer email and confirm both UI and backend prevent that batch.
10. Run one recovery sprint and confirm a successful queue row stores `status = sent`, `sent_at`, and the Resend `provider_message_id`.
11. Force an ambiguous provider/network failure and confirm the row remains `pending`, gets a delivery error code, and the API returns retryable HTTP `202` instead of reporting success.
12. Retry the same pending delivery inside the provider idempotency window and confirm the deterministic idempotency key is reused.
13. Confirm retrying after the safe provider window fails closed rather than risking a blind duplicate.
14. Start the same sprint concurrently and confirm one execution lease wins while the other reconciles persisted queue truth.
15. Create a queue uniqueness collision and confirm the runner re-reads the authoritative row instead of guessing its outcome.
16. Force a provider-accepted response while a stale worker has moved the queue row to `failed`; confirm Titan reconciles the confirmed provider acceptance back to `sent` without another provider request.
17. Mark an approved invoice paid before execution and confirm Titan records a stop/skip and does not send it.
18. Interrupt a monthly sprint, change the current UI selection, then recover it and confirm the original stored batch remains authoritative.
19. Mark one original monthly invoice paid before recovery and confirm recovery reconciles/stops that invoice instead of rejecting the entire stale sprint before recovery.
20. Exercise a legacy order/claim containing duplicate customer emails and confirm an existing recovery record reserves that customer while later duplicate-customer invoices are skipped.
21. Open **Follow-ups** and confirm Autopilot rows appear only under **Autopilot Recovery Receipts**, never in the manual pending queue.
22. Attempt the generic `sendFollowUp` endpoint against an Autopilot queue ID and confirm `AUTOPILOT_QUEUE_PROTECTED` is returned before any Resend call.
23. Double-trigger the same ordinary pending Follow-up and confirm Resend receives the same deterministic `followup_queue_<queue_id>` idempotency key and Titan reconciles the row as already sent rather than producing a second delivery.
24. Confirm first-party funnel events contain only allow-listed coarse fields and no customer/invoice/message content.

## Honest operating rules

- No purchased email lists or cold bulk email.
- Only the authenticated invoice owner can select recipients.
- One recovery sprint contacts each normalized customer email at most once.
- Recipient, amount, invoice number, and due date come from the user's own records.
- A successful provider response is not called auditable unless its receipt/status is persisted or reconciled.
- Ambiguous network delivery remains pending/retryable; it is never falsely reported as sent or failed with certainty.
- Confirmed provider acceptance is authoritative over a stale local failure state and must reconcile to `sent` without another provider request.
- A paid order cannot create duplicate recipient deliveries through retries, duplicate invoice selection, legacy batch recovery, or stale-run recovery.
- Autopilot Recovery Receipts cannot be manually resent, marked sent, or deleted through generic Follow-ups.
- Generic queued email sends also use deterministic provider idempotency and durable production rate limiting.
- Autopilot Stripe events are not acknowledged as processed until their exact webhook lease is committed to `processed`.
- Failed or stale Autopilot webhook claims may be reclaimed; a fresh concurrent claim must not be falsely acknowledged as complete.
- Failed delivery remains visible and is never reported as sent.
- Funnel telemetry is diagnostic only and must never block checkout or execution.
- Refunds and customer disputes remain owner-controlled in Stripe.

## Release gate

Do **not** enable the one-time paid flow or promote the Product Hunt relaunch until all of the following are true:

- GitHub quality checks have actually executed and passed; a workflow failure with zero runner steps is not a test result.
- A preview/production build has completed successfully on the active hosting account.
- Migration 018 and every required Autopilot migration above are applied before the corresponding code is enabled.
- `node scripts/verify-autopilot-db-security.mjs` passes against the target Supabase project.
- Stripe claim-state replay/recovery tests pass against the target database.
- Stripe and Resend live credentials are present and belong to the intended production accounts.
- The end-to-end certification sequence passes with controlled test recipients.
- Public `/autopilot`, signed-in Recovery Command Center, and Follow-ups Recovery Receipts are visually checked on mobile and desktop.

## Titan family path

Reuse the same order → approval → settlement → atomic execution → provider-idempotent delivery → immutable receipt/audit pattern for future programs:

- Titan Office: estimate follow-up and weekly reporting
- Titan Driver: mileage and earnings summaries
- Titan Fleet: maintenance reminders
- Titan Home: household scheduling and document reminders

Each program should launch with one measurable outcome and verifiable execution evidence before adding more automation types.
