# Titan Autopilot revenue launch

## Sellable service

**Invoice Recovery Sprint — $9 one-time**

- The signed-in business selects 1–10 overdue, unpaid invoices with customer email addresses.
- Checkout records the exact approved invoice IDs before payment.
- The configured Stripe Price is verified server-side as active, one-time, USD, and exactly $9.00 before Checkout is created.
- Stripe Checkout collects payment; only a verified, settled webhook unlocks execution.
- The buyer explicitly starts delivery after returning from Checkout.
- TitanOS rechecks each invoice immediately before delivery and stops invoices that are no longer eligible.
- TitanOS sends one factual payment reminder per selected invoice through Resend.
- Each provider request uses a deterministic Resend idempotency key so ambiguous network retries do not blindly send a second email.
- Every Autopilot attempt is stored in `follow_up_queue`, including provider message ID or normalized delivery error code when available.
- Autopilot queue rows are read-only to ordinary signed-in clients; the service-role runner owns mutation/reconciliation.
- The paid order and monthly sprint use compare-and-set execution leases so stale workers cannot overwrite a newer recovery attempt.
- Monthly recovery preserves the original approved invoice batch instead of replacing it with a later UI selection.

This is a real service deliverable, not advertising revenue or a claim that payment is guaranteed.

## Sandbox catalog

- Product: `prod_UzvOMcH0CcJcIK`
- Price: `price_1TzvXZIMo997dzoAgcgt4Br1` ($9 USD)
- Account: `titanos sandbox`
- Set `STRIPE_AUTOPILOT_PRICE_ID` to the sandbox price on preview deployments.

Never use the sandbox price ID with a live secret key. Create a matching live product after owner review and use its live `price_...` ID.

## Required migration order

Apply migrations before enabling the upgraded product paths:

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

The queue-protection migration is a release requirement, not optional UI hardening.

## Required production configuration

1. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_AUTOPILOT_PRICE_ID` on the production host.
2. Set `RESEND_API_KEY` and a verified `RESEND_FROM` domain.
3. Subscribe the Stripe webhook endpoint to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
4. Confirm the configured live Autopilot Price is active, one-time, USD, and exactly $9.00. The server deliberately fails closed if it is not.

## End-to-end certification sequence

1. Run a live-mode controlled checkout and confirm `payments.status = succeeded` only after Stripe reports `payment_status = paid`.
2. Confirm returning from Checkout before webhook settlement cannot execute the order.
3. Run one recovery sprint and confirm a successful queue row stores `status = sent`, `sent_at`, and the Resend `provider_message_id`.
4. Force an ambiguous provider/network failure and confirm the row remains `pending`, gets a delivery error code, and the API returns retryable HTTP `202` instead of reporting success.
5. Retry the same pending delivery inside the provider idempotency window and confirm the deterministic idempotency key is reused.
6. Confirm retrying after the safe provider window fails closed rather than risking a blind duplicate.
7. Start the same sprint concurrently and confirm one execution lease wins while the other reconciles persisted queue truth.
8. Create a queue uniqueness collision and confirm the runner re-reads the authoritative row instead of guessing its outcome.
9. Mark an approved invoice paid before execution and confirm Titan records a stop/skip and does not send it.
10. Interrupt a monthly sprint, change the current UI selection, then recover it and confirm the original stored batch remains authoritative.
11. Mark one original monthly invoice paid before recovery and confirm recovery reconciles/stops that invoice instead of rejecting the entire stale sprint before recovery.
12. Open **Follow-ups** and confirm Autopilot rows appear only under **Autopilot Recovery Receipts**, never in the manual pending queue.
13. Attempt the generic `sendFollowUp` endpoint against an Autopilot queue ID and confirm `AUTOPILOT_QUEUE_PROTECTED` is returned before any Resend call.
14. Attempt direct authenticated update/delete of an `autopilot_run:*` row and confirm RLS denies it.
15. Confirm first-party funnel events contain only allow-listed coarse fields and no customer/invoice/message content.

## Honest operating rules

- No purchased email lists or cold bulk email.
- Only the authenticated invoice owner can select recipients.
- Recipient, amount, invoice number, and due date come from the user's own records.
- A successful provider response is not called auditable unless its receipt/status is persisted or reconciled.
- Ambiguous network delivery remains pending/retryable; it is never falsely reported as sent or failed with certainty.
- A paid order cannot create duplicate recipient deliveries through retries or stale-run recovery.
- Autopilot Recovery Receipts cannot be manually resent, marked sent, or deleted through generic Follow-ups.
- Failed delivery remains visible and is never reported as sent.
- Funnel telemetry is diagnostic only and must never block checkout or execution.
- Refunds and customer disputes remain owner-controlled in Stripe.

## Release gate

Do **not** enable the one-time paid flow or promote the Product Hunt relaunch until all of the following are true:

- GitHub quality checks have actually executed and passed; a workflow failure with zero runner steps is not a test result.
- A preview/production build has completed successfully on the active hosting account.
- Every required migration above is applied before the corresponding code is enabled.
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
