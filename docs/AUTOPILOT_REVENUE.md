# Titan Autopilot — free access and future monetization

## Current product policy

Titan Autopilot is **free for now**.

There is no active Autopilot checkout, one-time price, paid membership requirement, or Stripe entitlement. The current product goal is adoption, reliability, and proof of value before monetization.

The active service is:

**Free Recovery Sprint**

- A signed-in business selects up to 10 overdue, unpaid invoices.
- A sprint allows only **one invoice per normalized customer email**.
- Titan persists the exact approved `invoice_id + customer_email` recipient snapshot in a service-managed `autopilot_runs` record.
- Titan rechecks invoice eligibility and approved-recipient consistency immediately before delivery.
- An invoice that became paid/no-longer-eligible is stopped.
- A recipient that changed after approval is stopped and requires fresh approval; Titan never invents a replacement address.
- A new sprint cannot remind the same invoice again inside the 72-hour repeat-reminder safety window.
- Titan sends one factual payment reminder through Resend.
- Provider requests use deterministic Resend idempotency keys.
- Ambiguous provider/network outcomes remain `pending` and retryable only inside the provider-safe window.
- Provider message IDs and normalized delivery errors are preserved in `follow_up_queue`.
- Autopilot Recovery Receipts are read-only to ordinary authenticated clients; service-role runners own mutation/reconciliation.
- Retry requests use the stored run ID and the original approved recipient snapshot.

This is a concrete follow-up workflow, not a guarantee of collection.

## Paid Autopilot flows are retired

The following endpoints remain as compatibility tombstones only and return HTTP `410`:

- `api/functions/createAutopilotOrder.js`
- `api/functions/runAutopilotOrder.js`
- `api/functions/runAutopilotMembership.js`

They must not create Checkout sessions, payment records, paid entitlements, or delivery activity.

Historical payment/membership schema and migrations may remain in repository/database history so old data and migration ordering are preserved. They are not part of the active free runtime contract.

## Active free runtime

The active Autopilot execution endpoint is:

- `api/functions/runAutopilotFree.js`

It requires:

- authenticated ownership;
- durable server-side rate limiting;
- eligible owner-owned invoices;
- exact approved recipient snapshots;
- `autopilot_runs` service ledger;
- protected `follow_up_queue` Recovery Receipts;
- configured Resend credentials;
- final invoice/recipient revalidation;
- deterministic provider idempotency;
- safe retry reconciliation.

It does **not** require:

- Stripe;
- a price ID;
- Checkout;
- a subscription;
- `paying_subscriber`;
- a plan tier;
- a payment webhook.

## TitanOS / Titan Attention isolation

TitanOS/Autopilot and Titan Attention are separate product surfaces sharing one repository.

### TitanOS / Autopilot

- intended host/project: `titanos-web`;
- `VITE_APP_SURFACE=titanos` preferred;
- server/client Supabase project refs must agree;
- Autopilot is free and exits the shared Stripe webhook route before Stripe code is loaded;
- no Autopilot Stripe environment variables are required;
- production registration remains product-owned and durably rate-limited.

### Titan Attention

Titan Attention may retain its own payment functionality independently. Its Stripe/database configuration must remain isolated from TitanOS/Autopilot.

Removing Stripe from Autopilot does not authorize changing or removing Titan Attention payments.

## Free-run database boundary

The active free execution path uses `public.autopilot_runs`.

Required properties:

- service-managed run IDs;
- exact ordered invoice IDs;
- exact approved recipient snapshot;
- running / retryable / completed / failed state;
- sent / failed / stopped / pending counters;
- client-deny RLS for `anon` and `authenticated`;
- service-role execution only.

Recovery Staging has been live-probed to confirm the free-run table exists, the `free_run_started/free` telemetry contract is accepted, ordinary client roles cannot write the run ledger, and service-level synthetic records can be created and cleaned safely.

## Recovery Receipts

Autopilot deliveries use deterministic `autopilot_run:*` queue keys.

The boundary requires:

- owner read access;
- authenticated insert/update/delete denial for Autopilot Receipt rows;
- generic `sendFollowUp` rejection before provider execution;
- provider message ID preservation;
- normalized delivery error evidence;
- ambiguous results remaining pending;
- safe retry only with the same run/recipient/provider-idempotency contract.

## Repeat-reminder protection

Free access must not create a spam incentive.

The server enforces a **72-hour per-invoice cooldown** across Autopilot Recovery Receipts. Starting a different free sprint does not bypass the cooldown.

This is a safety rule, not a paid usage limit.

## Signup / Auth boundary

Product Hunt onboarding remains part of release readiness even though Autopilot is free.

Required production behavior:

1. `/api/register` uses durable cross-instance throttling and fails closed when that protection is unavailable.
2. Production registration uses Supabase admin `generateLink(type: "signup")` to create the unconfirmed account and obtain a six-digit OTP.
3. Titan sends that OTP through Resend with deterministic provider idempotency.
4. Definitive provider rejection permits a clean retry; ambiguous delivery preserves the valid pending account/code instead of pretending the send failed.
5. Browser verification preserves the refreshable Supabase session established by `verifyOtp()`.
6. `/api/resendSignupOtp` is bound to the exact pending `userId + email`.
7. A previously abandoned unconfirmed signup is recoverable only after password proof.
8. Confirm-required users do not consume optional Founding entitlements before Auth verification.

## Production configuration

Autopilot requires:

1. TitanOS server/client Supabase values that resolve to the same intended project.
2. `RESEND_API_KEY` and a verified `RESEND_FROM` sender/domain.
3. A durable rate-limit backend; do not weaken `requireDurable: true`.
4. The free-run, Recovery Receipt, recipient-snapshot, telemetry, rate-limit, and signup compatibility schema present on the target TitanOS database.
5. `VITE_APP_SURFACE=titanos` or an equivalent unambiguous TitanOS deployment mapping.

Autopilot does **not** require `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_AUTOPILOT_PRICE_ID`, or `VITE_AUTOPILOT_ONETIME_CHECKOUT`.

## End-to-end certification sequence

1. Verify anonymous `/autopilot` loads the lightweight public preview and clearly communicates free access.
2. Create a fresh account and prove the initial six-digit verification OTP is delivered.
3. Verify/resend OTP and prove the browser session returns to `/autopilot`.
4. Verify authenticated `/autopilot` loads the private Recovery Command Center without a paid-plan gate.
5. Attempt the retired paid endpoints and require HTTP `410` with no charge/payment side effect.
6. Select up to 10 unique customers and run `runAutopilotFree`.
7. Confirm the created `autopilot_runs` record stores the exact approved invoice/recipient batch.
8. Confirm successful Recovery Receipt fields include `status=sent`, `sent_at`, and provider message ID.
9. Mark an approved invoice paid before delivery and confirm stop/skip with no provider request.
10. Change an approved customer email before delivery and confirm recipient-drift stop with no replacement inference.
11. Force an ambiguous provider/network outcome and confirm `pending` + HTTP `202` + stable `run_id`.
12. Retry with that `run_id` and confirm the same provider idempotency key is reused.
13. Retry outside the provider-safe window and confirm fail-closed behavior.
14. Attempt a second new sprint for the same invoice inside 72 hours and confirm repeat-reminder protection stops delivery.
15. Attempt a batch containing two invoices for the same normalized email and confirm UI + backend rejection.
16. Confirm generic Follow-ups cannot send/edit/delete an Autopilot Recovery Receipt.
17. Confirm funnel telemetry contains only allow-listed coarse metadata and active runs use `mode=free`.
18. Perform mobile + desktop walkthroughs on the current branch deployment.

## Future revenue direction: advertising

Advertising is a **future option**, not part of the current release.

No ad SDK, ad network, placement, targeting, or advertiser data sharing should be introduced until the product has enough usage to justify a separate privacy/security review.

A future ad design should follow these constraints:

- ads must not interrupt recovery execution or obscure safety warnings;
- ads must never be inserted into customer reminder emails;
- customer names, emails, invoice values, invoice IDs, message contents, and Recovery Receipt data must not be shared with advertisers;
- transactional Resend delivery and ad systems must remain separate;
- ad failure must never block Autopilot;
- sponsored content must be clearly distinguishable from Titan controls;
- any personalized advertising requires an explicit privacy/legal review before implementation.

For now, the optimization target is **activation and trust**, not monetization.

## Release gate

Do **not** promote the Product Hunt relaunch until all are true:

- GitHub quality checks have actually executed and `gate:ship` passes;
- the current branch has a legitimate successful preview/production build;
- TitanOS host/database mapping is verified;
- the free-run/RLS capability is present on the target database;
- `verify-autopilot-db-security.mjs` passes against the exact target;
- fresh-account OTP, resend, verification, persistent session, and `/autopilot` return E2E pass;
- the retired paid endpoints cannot create a charge;
- `runAutopilotFree` completes a controlled Resend delivery and preserves a Recovery Receipt;
- safe retry and 72-hour repeat-reminder protection are verified;
- public preview, signup/OTP, private Recovery Command Center, and Recovery Receipts pass mobile + desktop walkthroughs.

## Titan family pattern

For future Titan programs, reuse the core pattern:

**approval → atomic execution → provider-idempotent action → immutable evidence**

Monetization should remain outside that trust boundary unless a future product explicitly requires it.
