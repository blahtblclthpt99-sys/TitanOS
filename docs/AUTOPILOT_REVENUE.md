# Titan Autopilot revenue launch

## Sellable service

**Invoice Recovery Sprint — $9 one-time**

- The signed-in business selects 1–10 overdue, unpaid invoices with customer email addresses.
- The checkout records the exact approved invoice IDs before payment.
- The configured Stripe Price is verified server-side as active, one-time, USD, and exactly $9.00 before Checkout is created.
- Stripe Checkout collects payment; only a verified, settled webhook unlocks execution.
- The buyer explicitly starts delivery after returning from Checkout.
- TitanOS rechecks each invoice immediately before delivery and stops invoices that are no longer eligible.
- TitanOS sends one factual payment reminder per selected invoice through Resend.
- Each provider request uses a deterministic Resend idempotency key so ambiguous network retries do not blindly send a second email.
- Every attempt is stored in `follow_up_queue`, including provider message ID or normalized delivery error code when available.
- The paid order uses compare-and-set execution leases so stale workers cannot overwrite a newer recovery attempt.

This is a real service deliverable, not advertising revenue or a claim that payment is guaranteed.

## Sandbox catalog

- Product: `prod_UzvOMcH0CcJcIK`
- Price: `price_1TzvXZIMo997dzoAgcgt4Br1` ($9 USD)
- Account: `titanos sandbox`
- Set `STRIPE_AUTOPILOT_PRICE_ID` to the sandbox price on preview deployments.

Never use the sandbox price ID with a live secret key. Create a matching live product after owner review and use its live `price_...` ID.

## Required production configuration

1. Apply `supabase/migrations/041_titan_autopilot.sql`.
2. Apply `supabase/migrations/042_autopilot_membership_claims.sql` when the monthly included sprint is enabled.
3. Apply `supabase/migrations/20260914130000_autopilot_delivery_idempotency.sql` before deploying the hardened runners. This adds the unique delivery key plus `provider_message_id` and `delivery_error_code` audit fields.
4. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_AUTOPILOT_PRICE_ID` on the production host.
5. Set `RESEND_API_KEY` and a verified `RESEND_FROM` domain.
6. Subscribe the existing Stripe webhook endpoint to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
7. Confirm the configured live Autopilot Price is active, one-time, USD, and exactly $9.00. The server deliberately fails closed if it is not.
8. Run a live-mode test checkout and confirm `payments.status = succeeded` only after Stripe reports `payment_status = paid`.
9. Run one recovery sprint and confirm a successful queue row stores `status = sent`, `sent_at`, and the Resend `provider_message_id`.
10. Force an ambiguous provider/network failure and confirm the row remains `pending`, gets a delivery error code, and the API returns a retryable `202` state instead of reporting success.
11. Retry that same pending delivery inside the provider idempotency window and confirm the same deterministic idempotency key is reused.
12. Confirm retrying after the safe provider window fails closed rather than risking a blind duplicate.
13. Start the same sprint concurrently and confirm only one execution lease wins.
14. Mark an approved invoice paid before execution and confirm Titan does not send it.

## Honest operating rules

- No purchased email lists or cold bulk email.
- Only the authenticated invoice owner can select recipients.
- Recipient, amount, invoice number, and due date come from the user's own records.
- A successful provider response is not called auditable unless its receipt/status is persisted.
- Ambiguous network delivery remains pending/retryable; it is never falsely reported as sent or failed with certainty.
- A paid order cannot create duplicate recipient deliveries through retries or stale-run recovery.
- Failed delivery remains visible and is never reported as sent.
- Refunds and customer disputes remain owner-controlled in Stripe.

## Release gate

Do **not** enable the one-time paid flow in production until all of the following are true:

- GitHub quality checks have actually executed and passed; a workflow failure with zero runner steps is not a test result.
- A preview/production build has completed successfully on the active hosting account.
- The required migrations are applied before the new runner code.
- Stripe and Resend live credentials are present and belong to the intended production accounts.
- The end-to-end smoke tests above pass with controlled test recipients.

## Titan family path

Reuse the same order → approval → settlement → atomic execution → provider-idempotent delivery → receipt/audit pattern for future programs:

- Titan Office: estimate follow-up and weekly reporting
- Titan Driver: mileage and earnings summaries
- Titan Fleet: maintenance reminders
- Titan Home: household scheduling and document reminders

Each program should launch with one measurable paid outcome before adding more automation types.
