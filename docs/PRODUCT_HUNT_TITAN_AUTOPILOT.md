# Titan Autopilot — Product Hunt launch playbook

**Product:** Titan Autopilot / TitanOS  
**Core outcome:** Turn overdue invoices into approved, trackable follow-ups without spending the day chasing payments.  
**Product URL:** `/autopilot` on the TitanOS production domain  
**Product Hunt hub:** `https://www.producthunt.com/products/titan-autopilot`

## 1. Positioning

### Recommended tagline

**Recover overdue revenue without chasing customers manually**

Treat this as outcome-led shorthand, not a collection guarantee. Titan Autopilot automates a controlled invoice follow-up workflow and preserves delivery/recovery evidence. It does not claim money was recovered unless a separate verified payment event proves it.

### One-sentence description

Titan Autopilot finds eligible overdue invoices, lets the business approve exact recipients, rechecks each invoice immediately before action, sends one factual reminder through a provider-idempotent path, and preserves a read-only Recovery Receipt for every sent, stopped, failed, or retry-needed outcome.

### Differentiator

Automated invoice reminders are common. Do not market Titan as generic “AI reminders.” The product is **controlled, crash-safe recovery execution with proof**:

> **Find overdue invoices → approve exact recipients → preview what leaves → execute safely → keep auditable evidence.**

The trust model is a product feature:

- no cold lists;
- no hidden recipients;
- at most one invoice per normalized customer email per sprint;
- exact recipient approval is snapshotted before execution;
- recipient drift after approval stops delivery and requires fresh approval;
- no automatic claim that money was recovered;
- no reminder to an invoice that became paid before execution;
- deterministic provider idempotency during safe retries;
- provider message receipt IDs retained after acceptance;
- ambiguous network outcomes remain `pending`, not fabricated success/failure;
- confirmed provider acceptance can reconcile stale local failure without a second provider request;
- Autopilot Recovery Receipts cannot be manually resent/deleted through generic Follow-ups;
- one-time execution cannot begin until Stripe settlement is verified;
- Autopilot Stripe events use recoverable processing leases;
- unrelated or Titan Attention Stripe events cannot touch the TitanOS/Autopilot ledger.

Product Hunt's current featuring guidance emphasizes useful, novel, high-craft, and creative products. Titan's strongest angle is usefulness + high craft + a visible trust/reliability model rather than novelty theater.

## 2. Relaunch qualification

A third-party launch index lists TitanOS under the Titan Autopilot hub on **August 10, 2026**. Verify the launch date directly inside Product Hunt before scheduling another launch.

Product Hunt currently asks Makers to wait at least six months between posts for the same product/company unless an early relaunch is approved, and a relaunch still requires a **significant** product update. UI or pricing changes alone are not enough.

This branch is a material functional release:

1. repaired one-time Stripe settlement and fail-closed $9 price validation;
2. retry-safe canonical Stripe webhook claims and compare-and-set settlement;
3. explicit Stripe product isolation between TitanOS/Autopilot and Titan Attention;
4. exact owner-matched recipient snapshots and recipient-drift stops;
5. provider-level idempotency and provider receipt evidence;
6. stale-run/concurrent-worker reconciliation;
7. one-customer-per-sprint protection, including legacy recovery;
8. paid-after-approval safety stop;
9. immutable Recovery Receipts across generic Follow-ups;
10. original-batch preservation for monthly recovery;
11. public Recovery Command Center preview and truthful outcome states;
12. privacy-minimized first-party activation telemetry;
13. restored TitanOS root application while preserving Titan Attention as an isolated second product surface;
14. Recovery Staging database/RLS/rate-limit certification.

**Relaunch framing:** Titan Autopilot moved from a basic reminder flow into a controlled Recovery Command Center with verified settlement, exact recipient authorization, replay-safe payments, provider-level duplicate protection, live safety stops, interruption recovery, immutable Recovery Receipts, and a public product preview.

Official references:

- `https://help.producthunt.com/en/articles/484934-can-i-relaunch-my-product`
- `https://help.producthunt.com/en/articles/9883485-product-hunt-featuring-guidelines`
- `https://www.producthunt.com/launch`

## 3. Listing material

### Name

**Titan Autopilot**

### Tagline candidates

Primary:

**Recover overdue revenue without chasing customers manually**

Alternatives:

- **Approve overdue invoices. Titan follows up — safely.**
- **Invoice recovery with approval, safety stops, and proof**

### Short description

Titan Autopilot turns overdue invoices into an owner-approved recovery workflow. Select up to 10 eligible customers, preview the reminder, approve exact recipients, and let Titan execute the repetitive follow-up. Titan rechecks every invoice before delivery, protects retries from duplicate sends, and preserves a Recovery Receipt for every outcome.

### Maker-comment policy

**Do not paste an AI-written Maker comment.** Product Hunt's Commenting Guidelines say AI-generated comments are not allowed because comments are intended to be person-to-person.

The Maker should write the first comment personally. Useful factual topics:

- the real problem that led to Titan Autopilot;
- what the first version could not do safely;
- what materially changed;
- why exact recipient approval and paid-invoice stops matter;
- why ambiguous provider outcomes are handled conservatively;
- what kind of product feedback is most valuable.

Do not copy these bullets verbatim as a generated comment.

## 4. Gallery story — five frames

Each image should answer one question. Avoid generic dashboards or fabricated social proof.

1. **The problem / queue** — “These invoices are overdue.” Show overdue age and balance.
2. **The control** — “You choose exactly who Titan can contact.” Show approval, unique-customer rule, and selected balance.
3. **The preview** — “See the reminder before execution.” Show exact factual reminder and approval language.
4. **The safety layer** — “Paid invoices stop. Safe retries do not double-send.” Explain final eligibility check + provider idempotency.
5. **The proof** — “Every action leaves a Recovery Receipt.” Show sent/stopped/retry-needed evidence without exposing customer data.

Do **not** manufacture customer logos, testimonials, recovery percentages, recovered dollars, or activity counts. Use clearly marked sample data until real permissioned metrics exist.

## 5. Demo script

Keep the demo on one recovery job:

1. Open the lightweight public `/autopilot` preview.
2. Sign into a seeded non-production demo account.
3. Show three overdue sample invoices for three distinct customers.
4. Select the oldest three customers.
5. Show the approved overdue balance.
6. Read the exact reminder preview.
7. Run the sprint against a controlled recipient sandbox.
8. Show one provider-accepted `sent` result.
9. Mark one approved demo invoice paid and demonstrate the pre-send safety stop.
10. Show read-only Recovery Receipts and a safe-retry state.
11. End on: **nothing sends without approval, and retries preserve duplicate protection.**

Target: roughly 35–55 seconds. Do not turn the video into a general TitanOS tour.

## 6. Runtime architecture required for launch

TitanOS and Titan Attention are two product surfaces in the same repository and must remain isolated at runtime.

### TitanOS / Autopilot surface

- intended Vercel project: `titanos-web`;
- `VITE_APP_SURFACE=titanos` preferred;
- client Supabase must point at the certified TitanOS database, not the Attention-only project;
- `TITAN_STRIPE_WEBHOOK_PRODUCT=autopilot` preferred on server functions;
- `/autopilot` must load the public `AutopilotPublic` route for anonymous visitors;
- authenticated `/autopilot` must enter `AuthenticatedShell`/`TabStack` and the private Recovery Command Center.

### Titan Attention surface

- intended Vercel project: `titan-os`;
- `VITE_APP_SURFACE=attention` preferred;
- its Supabase environment stays on the Attention schema;
- `TITAN_STRIPE_WEBHOOK_PRODUCT=attention` preferred.

### Stripe webhook isolation

`api/functions/stripeWebhook.js` is the only public shared Stripe webhook route. It must:

1. verify Stripe signature before product classification;
2. classify Autopilot only from `task_type=invoice_recovery_sprint`;
3. classify Attention only from `kind=attention_campaign_funding`;
4. acknowledge unclassified signed events without opening Supabase;
5. acknowledge cross-product events as scope mismatches without touching the wrong database;
6. delegate matching events to the private `api/_lib/stripeWebhookProductHandler.js` implementation.

Do not expose the private handler as another `api/functions/*` route.

## 7. Recovery Staging database order

Prerequisite: the canonical `public.stripe_webhook_events` base schema exists. Certification is based on schema capability, **not** whether historical migration `018` appears in migration history.

Required order for a recovered TitanOS environment:

1. `041_titan_autopilot.sql`
2. `042_autopilot_membership_claims.sql`
3. `20260914130000_autopilot_delivery_idempotency.sql`
4. `20260914193000_autopilot_funnel_events.sql`
5. `20260914194500_autopilot_queue_rls.sql`
6. `20260914203000_stripe_webhook_claim_state.sql`
7. `20260914210000_autopilot_recipient_snapshot.sql`
8. `20260914211500_restore_durable_rate_limit_backend.sql`

Recovery Staging (`wbymywwrpbljfbsemung`) has passed schema, RLS, recipient-integrity, signup-trigger, security-advisor, and durable-rate-limit probes. That is **database/runtime certification only**, not production launch certification.

## 8. Launch conversion + production checklist

Before a Product Hunt launch/relaunch request:

- direct `/autopilot` opens the public preview without forcing sign-in;
- public preview remains isolated from `useAuth`, invoice entities, private function calls, and the full API client;
- public telemetry uses the lightweight same-origin path and never blocks rendering;
- anonymous preview works at iPhone and desktop widths;
- authenticated `/autopilot` resolves to the private Recovery Command Center;
- the `titanos-web` runtime points at the intended TitanOS Supabase project;
- the Attention deployment remains on the Attention schema;
- the eight recovery-compatible migrations are present where required;
- `node scripts/verify-autopilot-db-security.mjs` passes against the target database;
- durable outbound rate limiting is available and `requireDurable: true` remains intact;
- one-time Checkout works end-to-end with the live $9 Stripe price if the one-time option is enabled;
- `VITE_AUTOPILOT_ONETIME_CHECKOUT=true` is verified only when the one-time $9 CTA is intended to be live;
- Stripe promotes the exact Autopilot payment only after a signed paid event;
- webhook replay/stale/concurrent-claim behavior is verified;
- cross-product and unclassified Stripe event routing is verified against both deployments;
- delayed-payment success/failure and Checkout expiry are verified;
- Resend sender/domain is verified;
- one-customer-per-sprint enforcement is verified in UI + backend;
- repeat-click, concurrent-run, stale-run, paid-after-approval, ambiguous-network, provider-receipt, acceptance-reconciliation, generic-Follow-ups isolation, and cancel scenarios are tested;
- sample/demo information is clearly labeled;
- pricing shown publicly matches production configuration;
- Maker writes their own first comment;
- gallery tells one coherent story;
- sharing asks for product feedback/discussion, not coordinated or incentivized upvotes.

## 9. Activation telemetry

The first-party `autopilot_funnel_events` table stores only allow-listed coarse metadata: event, source bucket, mode, invoice count, and outcome. It does not store customer names, emails, invoice IDs/numbers, message bodies, raw referrers, IPs, or exact balances.

Track:

- Product Hunt/direct visitor → preview viewed;
- preview → signed-in view;
- signed in → eligible invoices loaded;
- eligible → batch approved;
- approved → Checkout or membership run started;
- execution → completed / retry-needed / failed;
- completed → repeat adoption/monthly workflow.

The public and private trackers share only the coarse `titan_autopilot_source` session bucket so Product Hunt attribution can survive sign-in without persisting a raw referrer.

## 10. No-go conditions

Do not submit/relaunch if any of these are true:

- CI has not actually executed `gate:ship` successfully;
- current-branch hosting/preview is unavailable;
- the production runtime database/project mapping is unverified;
- any required Autopilot migration/capability is absent;
- the public `/autopilot` preview is unreachable, slow-blocked by auth, or errors on mobile;
- authenticated `/autopilot` does not reach the Recovery Command Center;
- Attention and Autopilot can touch each other's database ledgers;
- a second public webhook route bypasses product classification;
- webhook settlement/replay behavior is unverified in production-like conditions;
- a claimed failed/stale event can become a permanent false duplicate;
- a fresh concurrent claim can be acknowledged as processed without processing;
- checkout can return paid while Titan reports pending indefinitely;
- an interrupted/ambiguous run can resend outside the provider-idempotent path;
- a sprint can contact the same normalized customer email more than once;
- generic Follow-ups can edit/delete/send an Autopilot Recovery Receipt;
- a paid invoice can receive a reminder after the final eligibility check;
- provider acceptance can be reported without preserved evidence/reconciliation;
- the listing promises recovery rates or money results Titan has not verified;
- the only meaningful change from the prior launch is visual styling or pricing.

A Product Hunt launch should amplify a production-grade product, not serve as its production test.
