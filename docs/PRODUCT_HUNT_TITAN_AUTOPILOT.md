# Titan Autopilot — Product Hunt launch playbook

**Product:** Titan Autopilot / TitanOS  
**Core outcome:** Turn overdue invoices into approved, trackable follow-ups without spending the day chasing payments.  
**Product URL:** `/autopilot` on the production TitanOS domain  
**Product Hunt hub:** `https://www.producthunt.com/products/titan-autopilot`

## 1. Positioning

### Recommended tagline

**Recover overdue revenue without chasing customers manually**

Use this as an outcome-led shorthand, not as a claim that Titan guarantees collection. Inside the product, remain precise: Autopilot automates invoice follow-up and records delivery/recovery workflow outcomes; it does **not** claim the money was recovered unless a separate verified payment event proves that.

### One-sentence description

Titan Autopilot finds eligible overdue invoices, lets a business approve the exact recipients, rechecks each invoice immediately before action, sends one factual reminder through a provider-idempotent delivery path, and preserves a read-only Recovery Receipt for every sent, stopped, failed, or retry-needed outcome.

### Why it is different

Automated invoice reminders are already common. Do not position Titan as “AI that sends reminders.” Position the product around **controlled, crash-safe recovery execution**:

> **Find the overdue invoices → approve the batch → preview exactly what leaves → let Titan execute safely → keep provider-backed evidence.**

The trust model is part of the product:

- no cold lists;
- no hidden recipients;
- no automatic claim that money was recovered;
- no reminder to an invoice that became paid before execution;
- deterministic provider idempotency during safe retries;
- provider message receipt IDs retained after acceptance;
- ambiguous network outcomes remain `pending` instead of being falsely called sent;
- Autopilot queue evidence cannot be manually resent/deleted through generic Follow-ups;
- no one-time order execution until Stripe verifies settlement.

Product Hunt's current featuring guidance emphasizes products that are useful, novel, high-craft, and creative. Titan's strongest angle is **usefulness + high craft + an unusually explicit trust/reliability model** rather than novelty theater.

## 2. Product Hunt relaunch qualification

A third-party launch index lists TitanOS under the Titan Autopilot product hub on **August 10, 2026**. Verify the launch date inside Product Hunt before scheduling another launch.

Product Hunt currently asks Makers to wait at least six months between posts for the same product/company unless an early relaunch request is approved, and an early relaunch still requires a **significant** product update. Product Hunt explicitly says UI or pricing changes alone are not enough.

This branch is therefore a functional product upgrade:

1. repaired Stripe settlement for paid Autopilot orders;
2. fail-closed Stripe price validation before a payable order exists;
3. provider-level recipient idempotency;
4. stale-run and concurrent-worker reconciliation;
5. paid-after-approval safety stop;
6. provider receipt/error evidence;
7. immutable Autopilot audit records across generic Follow-ups;
8. original-batch preservation for monthly recovery;
9. sent / failed / stopped / retry-needed outcome reporting;
10. public Product Hunt-friendly preview and Recovery Command Center;
11. privacy-minimized first-party funnel telemetry.

**Relaunch request framing:** explain that Titan Autopilot moved from a basic one-shot reminder flow into a controlled Recovery Command Center with verified settlement, provider-level duplicate protection, live eligibility safety stops, interruption recovery, immutable Recovery Receipts, and measurable first-party activation telemetry.

Official references:

- `https://help.producthunt.com/en/articles/484934-can-i-relaunch-my-product`
- `https://help.producthunt.com/en/articles/9883485-product-hunt-featuring-guidelines`
- `https://www.producthunt.com/launch`

## 3. Product Hunt listing material

### Name

**Titan Autopilot**

### Tagline candidates

Primary:

**Recover overdue revenue without chasing customers manually**

Alternative:

**Approve overdue invoices. Titan follows up — safely.**

Alternative:

**Invoice recovery with approval, safety stops, and proof**

### Short description

Titan Autopilot turns overdue invoices into an owner-approved recovery workflow. Select up to 10 eligible invoices, preview the exact reminder, approve the recipients, and let Titan execute the repetitive follow-up. Titan rechecks every invoice before delivery, protects retries from duplicate sends, and preserves a Recovery Receipt for every outcome.

### Maker first-comment policy

**Do not paste an AI-written maker comment.** Product Hunt's Commenting Guidelines explicitly say AI-generated comments are not allowed because comments are intended to be person-to-person.

The Maker should write the first comment personally and in their own voice. Useful factual talking points to cover:

- the real problem that led to building Titan Autopilot;
- what was limited about the first version;
- what materially changed in this release;
- why owner approval and paid-invoice safety stops matter;
- why ambiguous network outcomes are handled conservatively;
- what kind of product feedback would be most useful.

Keep the comment personal, specific, and conversational. Do not copy these bullets verbatim as a generated comment.

## 4. Gallery story — five frames

Every Product Hunt image should answer one question. Avoid generic dashboards and unreadable full-app screenshots.

1. **The problem / queue** — “These invoices are overdue.” Show Recovery Command Center, overdue age, and balance.
2. **The control** — “You choose exactly who Titan can contact.” Show checkboxes, selected count, and approved balance.
3. **The preview** — “See the actual reminder before execution.” Show exact reminder preview and owner-approval language.
4. **The safety layer** — “Paid invoices stop. Safe retries do not double-send.” Show live eligibility recheck and provider idempotency in plain language.
5. **The proof** — “Every action leaves a Recovery Receipt.” Show provider acceptance, stopped invoice, and retry-needed evidence without exposing sensitive customer data.

Do **not** manufacture customer logos, testimonials, recovery percentages, dollars recovered, or activity counts. Use clearly marked sample data until there are real, permissioned metrics.

## 5. Interactive demo script

Keep the demo centered on one recovery job:

1. Land on the public Titan Autopilot preview.
2. Sign into a seeded demo environment.
3. Show three overdue sample invoices.
4. Tap **Select oldest 3**.
5. Point out the selected overdue balance.
6. Read the exact reminder preview.
7. Run the sprint against a non-production recipient sandbox.
8. Show one provider-accepted `sent` result.
9. Change one approved demo invoice to paid and show Titan stop it before delivery.
10. Show the read-only Recovery Receipts and the safe-retry state.
11. End on the product principle: **nothing sends without approval, and retries preserve duplicate protection.**

Target demo length: roughly 35–55 seconds. One storyline, no general TitanOS feature tour.

## 6. Launch-page conversion and production checklist

Before a new Product Hunt launch or relaunch request:

- direct URL opens the public Autopilot preview without forcing sign-in first;
- no dead CTA and no environment-dependent blank state;
- mobile layout works at iPhone widths;
- one-time Checkout works end-to-end with the live $9 Stripe price;
- Stripe webhook promotes the exact Autopilot payment only when `payment_status=paid`;
- delayed-payment success/failure and Checkout expiry are verified;
- Resend sender domain is verified;
- migration `20260914130000_autopilot_delivery_idempotency.sql` is applied;
- migration `20260914193000_autopilot_funnel_events.sql` is applied;
- migration `20260914194500_autopilot_queue_rls.sql` is applied;
- repeat-click, concurrent-run, stale-run, paid-after-approval, ambiguous-network, provider-receipt, generic-Follow-ups isolation, and Stripe-cancel scenarios are tested;
- sample/demo information is explicitly labeled;
- pricing is visible and consistent with production;
- Maker writes their own first comment in their own voice;
- gallery tells one coherent story;
- interactive demo is embedded if Product Hunt supports the chosen provider;
- maker/team accounts are attached correctly;
- share the launch organically and invite people to try/discuss it; do **not** ask or incentivize people to upvote.

## 7. Launch-day operating plan

Product Hunt operates on a daily Pacific-time cycle. Optimize for preparedness, not a rushed date.

During launch day:

- respond personally to substantive questions;
- do not use AI-generated Product Hunt comments;
- convert repeated questions into FAQ/product fixes;
- keep a changelog of fixes made while the launch is live;
- share the launch with genuine users and communities without vote incentives;
- ask for product feedback and discussion, not coordinated voting;
- link people directly to the Product Hunt launch page;
- do not claim rankings, adoption, recovered dollars, or conversion rates unless verified.

## 8. Activation telemetry

Product Hunt rank is useful, but Titan should optimize for durable activation. The first-party `autopilot_funnel_events` table intentionally stores only allow-listed, coarse metadata—event, source bucket, mode, invoice count, and outcome. It does not store customer names, emails, invoice IDs/numbers, message bodies, raw referrers, IP addresses, or exact balances.

Measure these boundaries:

- Product Hunt/direct visitor → preview viewed;
- preview → signed-in view;
- signed in → eligible invoices loaded;
- eligible → batch approved;
- approved → Checkout or membership run started;
- execution → completed / retry-needed / failed;
- completed → user returns or adopts the monthly workflow.

Use those metrics to improve the product. Do not turn them into public claims until production data is verified and statistically meaningful.

## 9. No-go conditions

Do not submit/relaunch if any of these are true:

- webhook settlement is unverified in production;
- any required Autopilot migration is unapplied;
- the public preview or authenticated flow errors on mobile;
- checkout can return paid while Titan reports pending indefinitely;
- an interrupted/ambiguous run can resend a customer outside the provider-idempotent path;
- generic Follow-ups can edit/delete/send an Autopilot recovery row;
- a paid invoice can still receive a reminder after the final eligibility check;
- provider acceptance is reported as sent without preserved evidence/reconciliation;
- the Product Hunt listing promises recovery rates or money results Titan has not verified;
- the only meaningful change since the previous launch is visual styling or pricing;
- CI/build/deployment verification is blocked or failing.

A Product Hunt launch should amplify a production-grade product, not serve as its production test.
