# Titan Autopilot revenue launch

## Sellable service

**Invoice Recovery Sprint — $9 one-time**

- The signed-in business selects 1–10 overdue, unpaid invoices with customer email addresses.
- The checkout records the exact approved invoice IDs before payment.
- Stripe Checkout collects payment; only a verified, settled webhook unlocks execution.
- The buyer explicitly starts delivery after returning from Checkout.
- TitanOS sends one factual payment reminder per selected invoice through Resend.
- Every attempt is stored in `follow_up_queue`; the paid order is atomically single-run.

This is a real service deliverable, not advertising revenue or a claim that payment is guaranteed.

## Sandbox catalog

- Product: `prod_UzvOMcH0CcJcIK`
- Price: `price_1TzvXZIMo997dzoAgcgt4Br1` ($9 USD)
- Account: `titanos sandbox`
- Set `STRIPE_AUTOPILOT_PRICE_ID` to the sandbox price on preview deployments.

Never use the sandbox price ID with a live secret key. Create a matching live product after owner review and use its live `price_...` ID.

## Required production configuration

1. Apply `supabase/migrations/041_titan_autopilot.sql`.
2. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_AUTOPILOT_PRICE_ID` on Vercel.
3. Set `RESEND_API_KEY` and a verified `RESEND_FROM` domain.
4. Subscribe the existing Stripe webhook endpoint to `checkout.session.completed`.
5. Run a test checkout and confirm `payments.status = succeeded` only after `payment_status = paid`.
6. Run the sprint once and confirm the second run returns a duplicate/already-running response without another email.

## Honest operating rules

- No purchased email lists or cold bulk email.
- Only the authenticated invoice owner can select recipients.
- Recipient, amount, invoice number, and due date come from the user's own records.
- A paid order cannot be executed twice.
- Failed delivery remains visible and is never reported as sent.
- Refunds and customer disputes remain owner-controlled in Stripe.

## Titan family path

Reuse the same order → approval → settlement → atomic execution → audit pattern for future programs:

- Titan Office: estimate follow-up and weekly reporting
- Titan Driver: mileage and earnings summaries
- Titan Fleet: maintenance reminders
- Titan Home: household scheduling and document reminders

Each program should launch with one measurable paid outcome before adding more automation types.
