# Titan Autopilot — Product Hunt launch playbook

**Product:** Titan Autopilot / TitanOS  
**Core outcome:** Turn overdue invoices into approved, trackable follow-ups without spending the day chasing payments.  
**Product URL:** `/autopilot` on the production TitanOS domain  
**Product Hunt hub:** `https://www.producthunt.com/products/titan-autopilot`

## 1. Positioning

### Recommended tagline

**Recover overdue revenue without chasing customers manually**

Use this as the external outcome-led shorthand. Inside the product, remain more precise: Autopilot automates invoice follow-up and reports delivery outcomes; it does **not** guarantee collection or payment.

### One-sentence description

Titan Autopilot finds eligible overdue invoices, lets a business approve the exact recipients, sends one factual payment reminder, rechecks that the invoice is still unpaid before delivery, and records every sent, failed, or skipped outcome.

### Why it is different

Most automation pitches lead with “AI” or generic productivity. Titan Autopilot should lead with a measurable job:

> **Find the overdue invoices → approve the batch → let Titan do the repetitive follow-up → keep a verifiable audit trail.**

The trust model is part of the product:

- no cold lists;
- no hidden recipients;
- no automatic claim that money was recovered;
- no reminder to an invoice that became paid before execution;
- no duplicate send after a crash/retry;
- no local order execution until Stripe confirms settlement for the one-time paid flow.

## 2. Product Hunt relaunch qualification

A third-party Product Hunt launch index lists TitanOS under the Titan Autopilot product hub on **August 10, 2026**. Verify the launch date in Product Hunt before scheduling another launch.

Product Hunt's current relaunch policy asks makers to wait at least six months between posts for the same product/company unless a relaunch request is approved for a **significant** update. Product Hunt explicitly says a new UI or pricing change alone is not enough; new functionality or a complete redesign with new functionality can qualify.

This branch is therefore structured as a product upgrade rather than a cosmetic relaunch:

1. repaired Stripe settlement for paid Autopilot orders;
2. recipient-level execution idempotency;
3. stale-run recovery after interruption;
4. paid-after-approval safety stop;
5. sent / failed / skipped outcome reporting;
6. public Product Hunt-friendly product preview;
7. Recovery Command Center with balance visibility, oldest-first prioritization, batch selection, and exact reminder preview.

**Relaunch request framing:** “Titan Autopilot has moved from a basic one-shot invoice reminder screen to a crash-safe Recovery Command Center with payment-settlement enforcement, recipient-level duplicate protection, live eligibility safety stops, prioritized batch approval, exact message preview, and audited outcomes.”

Official references:

- `https://help.producthunt.com/en/articles/484934-can-i-relaunch-my-product`
- `https://www.producthunt.com/launch`

## 3. Product Hunt listing copy

### Name

**Titan Autopilot**

### Tagline candidates

Primary:

**Recover overdue revenue without chasing customers manually**

Alternative:

**Invoice follow-up that runs only after you approve it**

Alternative:

**Approve overdue invoices. Titan handles the follow-up.**

### Short description

Titan Autopilot turns overdue invoices into an owner-approved recovery workflow. Select up to 10 eligible invoices, preview the reminder, approve the recipients, and let Titan execute the repetitive follow-up. Every invoice is checked again before delivery and every result is recorded as sent, failed, or skipped.

### Maker first comment draft

We built Titan Autopilot around a simple frustration: small businesses often lose time repeatedly checking overdue invoices and sending the same polite reminder by hand.

The first version proved the workflow, but this release changes the reliability model substantially. Autopilot now verifies paid one-time orders before execution, protects each recipient from duplicate sends during retries, rechecks invoice eligibility immediately before delivery, safely recovers interrupted runs, and exposes sent / failed / skipped outcomes in a redesigned Recovery Command Center.

The goal is not to pretend software can guarantee collection. The goal is to make the repetitive, auditable part of invoice follow-up take a few deliberate clicks instead of repeated manual work.

I’d especially value feedback on the approval flow, reminder preview, and whether the safety controls are clear enough for something that communicates with customers on your behalf.

## 4. Gallery story — five frames

Every Product Hunt image should answer one question. Avoid generic dashboards and unreadable full-app screenshots.

1. **The problem / queue** — “These invoices are overdue.” Show Recovery Command Center, overdue age, and balance.
2. **The control** — “You choose exactly who Titan can contact.” Show checkboxes, selected count, and approved balance.
3. **The preview** — “See the actual reminder before execution.” Show exact reminder preview and owner-approval language.
4. **The safety layer** — “Paid invoices stop. Retries do not double-send.” Visualize paid-after-approval check + recipient-level idempotency in plain language.
5. **The result** — “Every outcome is visible.” Show sent / failed / skipped summary and audit trail.

Do **not** manufacture customer logos, testimonials, recovery percentages, dollars recovered, or activity counts. Use clearly marked sample data until there are real, permissioned metrics.

## 5. Interactive demo script

Product Hunt recommends showing how the product feels, not only describing it. Build a short interactive demo around one job:

1. Land on Titan Autopilot public preview.
2. Sign in to a seeded demo account or use a safe demo environment.
3. Show three overdue sample invoices.
4. Tap **Select oldest 3**.
5. Point out the selected overdue balance.
6. Open/read the exact reminder preview.
7. Run the recovery sprint in a non-production recipient sandbox.
8. Show one `sent`, one intentionally `skipped` because it became paid, and the audit history.
9. End on: **“Nothing sends without your approval.”**

Target demo length: 35–55 seconds. Keep one storyline and no feature tour detours.

## 6. Launch-page conversion checklist

Before a new Product Hunt launch or relaunch request:

- direct URL opens the public Autopilot preview without forcing sign-in first;
- no dead CTA and no environment-dependent blank state;
- mobile layout works at iPhone widths;
- one-time Checkout works end-to-end with a live Stripe product/price;
- Stripe webhook promotes the exact Autopilot payment only when `payment_status=paid`;
- Resend sender domain is verified;
- production migration `20260914130000_autopilot_delivery_idempotency.sql` is applied;
- repeat-click, concurrent-run, stale-run, paid-after-approval, Resend failure, and Stripe-cancel scenarios are tested;
- sample/demo information is explicitly labeled;
- pricing is visible and consistent with production;
- maker first comment is ready before launch;
- gallery tells one coherent story;
- interactive demo is embedded if Product Hunt supports the chosen provider;
- maker/team accounts are attached correctly;
- ask supporters to **visit, try, and comment** — never ask directly for an upvote.

## 7. Launch-day operating plan

Product Hunt says the best day is the day the launch is most prepared; for planned launches it recommends going live around **12:01 a.m. Pacific Time** to use the full ranking day.

During launch day:

- respond to every substantive question quickly and specifically;
- convert repeated questions into FAQ/product fixes;
- keep a changelog of fixes made while the launch is live;
- share the launch with genuine users and communities without vote incentives;
- ask for product feedback, not coordinated voting;
- link people to the direct Product Hunt launch page, not a chain of redirects;
- do not claim rankings, adoption, or recovered dollars unless verified.

## 8. Success criteria

Product Hunt rank is useful, but the product should optimize for durable conversion:

- Product Hunt visitor → Autopilot preview opened;
- preview → account/sign-in intent;
- signed in → at least one eligible invoice found;
- eligible → batch approved;
- approved → sprint successfully prepared/sent;
- completed → no duplicate sends;
- completed → user returns for another recovery workflow or upgrades to Pro;
- launch comments produce actionable product changes.

Add event instrumentation for these funnel boundaries before claiming conversion performance.

## 9. No-go conditions

Do not submit/relaunch if any of these are true:

- webhook settlement is unverified in production;
- the idempotency migration is not applied;
- the public preview or authenticated flow errors on mobile;
- checkout can return paid while Titan still reports pending indefinitely;
- an interrupted run can resend a customer;
- a paid invoice can still receive a reminder after the final eligibility check;
- the Product Hunt listing promises recovery rates or money results that Titan has not verified;
- the only meaningful change since the last launch is visual styling or pricing.

A Product Hunt launch should amplify a production-grade product, not serve as its production test.
