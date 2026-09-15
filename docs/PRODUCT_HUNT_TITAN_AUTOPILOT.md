# Titan Autopilot — Product Hunt launch playbook

**Product:** Titan Autopilot / TitanOS  
**Core outcome:** Turn overdue invoices into approved, trackable follow-ups without spending the day chasing payments.  
**Current access model:** Free — no checkout or paid membership.  
**Product URL:** `/autopilot` on the TitanOS production domain  
**Product Hunt hub:** `https://www.producthunt.com/products/titan-autopilot`

## 1. Positioning

### Recommended tagline

**Recover overdue revenue without chasing customers manually**

This is outcome-led shorthand, not a collection guarantee. Titan Autopilot automates a controlled invoice follow-up workflow and preserves delivery evidence. It does not claim money was recovered unless a separate verified payment record proves it.

### One-sentence description

Titan Autopilot finds eligible overdue invoices, lets the business approve exact recipients, rechecks each invoice immediately before action, sends one factual reminder through a provider-idempotent path, and preserves a read-only Recovery Receipt for every sent, stopped, failed, or retry-needed outcome.

### Differentiator

Automated invoice reminders are common. Titan should not be marketed as generic “AI reminders.” The product is **controlled, crash-safe recovery execution with proof**:

> **Find overdue invoices → approve exact recipients → preview what leaves → execute safely → keep auditable evidence.**

The trust model is a product feature:

- free access; no checkout or paid plan required;
- no cold lists;
- no hidden recipients;
- at most one invoice per normalized customer email per sprint;
- exact recipient approval is snapshotted before execution;
- recipient drift after approval stops delivery and requires fresh approval;
- no automatic claim that money was recovered;
- no reminder to an invoice that became paid before execution;
- a 72-hour per-invoice repeat-reminder cooldown prevents rapid repeat sends across separate free sprints;
- deterministic provider idempotency during safe retries;
- provider message receipt IDs retained after acceptance;
- ambiguous network outcomes remain `pending`, not fabricated success/failure;
- confirmed provider acceptance can reconcile stale local failure without a second provider request;
- Autopilot Recovery Receipts cannot be manually resent/deleted through generic Follow-ups;
- service-managed `autopilot_runs` records preserve exact approved batches and retry state;
- production signup uses one durable, product-owned verification path rather than silently changing mechanisms during outages.

Product Hunt's featuring guidance emphasizes useful, novel, high-craft, and creative products. Titan's strongest angle is usefulness + high craft + a visible trust/reliability model rather than novelty theater.

## 2. Relaunch qualification

A third-party launch index lists TitanOS under the Titan Autopilot hub on **August 10, 2026**. Verify the launch date directly inside Product Hunt before scheduling another launch.

Product Hunt currently asks Makers to wait at least six months between posts for the same product/company unless an early relaunch is approved, and a relaunch still requires a **significant** product update. UI or pricing changes alone are not enough.

This branch is a material functional release:

1. restored TitanOS as the primary application while preserving Titan Attention as an isolated second surface;
2. replaced paid Autopilot execution with a dedicated free-run service ledger;
3. retired paid Autopilot Checkout/order/membership endpoints so stale clients cannot create charges;
4. exact owner-matched recipient snapshots and recipient-drift stops;
5. provider-level idempotency and provider receipt evidence;
6. stale-run/concurrent-worker reconciliation;
7. one-customer-per-sprint protection;
8. 72-hour per-invoice repeat-reminder protection across separate sprints;
9. paid-after-approval safety stop;
10. immutable Recovery Receipts across generic Follow-ups;
11. public Recovery Command Center preview and truthful outcome states;
12. privacy-minimized first-party activation telemetry with a dedicated `free` mode;
13. Recovery Staging database/RLS/rate-limit certification;
14. product-owned signup OTP/resend, durable registration throttling, abandoned-signup recovery, and verified-only optional Founding entitlement claims.

**Relaunch framing:** Titan Autopilot moved from a basic reminder flow into a free, controlled Recovery Command Center with exact recipient authorization, repeat-send protection, provider-level duplicate protection, live safety stops, interruption recovery, immutable Recovery Receipts, a public product preview, and hardened launch onboarding.

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

Titan Autopilot turns overdue invoices into a free, owner-approved recovery workflow. Select up to 10 eligible customers, preview the reminder, approve exact recipients, and let Titan execute the repetitive follow-up. Titan rechecks every invoice before delivery, prevents rapid repeat reminders, protects retries from duplicate sends, and preserves a Recovery Receipt for every outcome.

### Maker-comment policy

**Do not paste an AI-written Maker comment.** Product Hunt comments are intended to be person-to-person.

The Maker should write the first comment personally. Useful factual topics:

- the real problem that led to Titan Autopilot;
- what the first version could not do safely;
- what materially changed;
- why exact recipient approval and paid-invoice stops matter;
- why the product is free for now;
- why ambiguous provider outcomes are handled conservatively;
- what kind of product feedback is most valuable.

## 4. Gallery story — five frames

Each image should answer one question. Avoid generic dashboards or fabricated social proof.

1. **The problem / queue** — “These invoices are overdue.” Show overdue age and balance.
2. **The control** — “You choose exactly who Titan can contact.” Show approval, unique-customer rule, and selected balance.
3. **The preview** — “See the reminder before execution.” Show exact factual reminder and approval language.
4. **The safety layer** — “Paid invoices stop. Rapid repeats stop. Safe retries do not double-send.” Explain final eligibility check + 72-hour cooldown + provider idempotency.
5. **The proof** — “Every action leaves a Recovery Receipt.” Show sent/stopped/retry-needed evidence without exposing customer data.

Do **not** manufacture customer logos, testimonials, recovery percentages, recovered dollars, or activity counts. Use clearly marked sample data until real permissioned metrics exist.

## 5. Demo script

Keep the demo on one recovery job:

1. Open the lightweight public `/autopilot` preview and show **Free to use**.
2. Create or sign into a seeded non-production demo account.
3. If demonstrating signup, show Titan's six-digit verification code flow and return to `/autopilot` without exposing the real recipient inbox.
4. Show three overdue sample invoices for three distinct customers.
5. Select the oldest three customers.
6. Show the approved overdue balance and clarify that it is **not a fee**.
7. Read the exact reminder preview.
8. Run the free sprint against a controlled recipient sandbox.
9. Show one provider-accepted `sent` result.
10. Mark one approved demo invoice paid and demonstrate the pre-send safety stop.
11. Show read-only Recovery Receipts and a safe-retry state.
12. End on: **nothing sends without approval, and retries preserve duplicate protection.**

Target: roughly 35–55 seconds if signup is omitted. Do not turn the video into a general TitanOS tour.

## 6. Runtime architecture required for launch

### TitanOS / Autopilot surface

- intended Vercel project: `titanos-web`;
- `VITE_APP_SURFACE=titanos` preferred;
- browser and server Supabase values must resolve to the same intended TitanOS project;
- `/autopilot` must load the public `AutopilotPublic` route for anonymous visitors;
- authenticated `/autopilot` must enter `AuthenticatedShell` / `TabStack` and the private Recovery Command Center;
- `runAutopilotFree` is the only active Autopilot execution endpoint;
- `createAutopilotOrder`, `runAutopilotOrder`, and `runAutopilotMembership` remain retired with HTTP `410` so stale clients cannot create or execute a paid Autopilot flow;
- the TitanOS Stripe webhook route exits before loading Stripe code because Autopilot has no Stripe dependency;
- production registration must use `/api/register`; direct browser `supabase.auth.signUp()` fallback is development-only.

### Titan Attention surface

Titan Attention is a separate product surface in the same repository. Its payment stack, if enabled, must remain isolated from TitanOS/Autopilot. Changes to Attention monetization are outside the Autopilot launch contract.

## 7. Recovery Staging database capability

The free runtime depends on:

- invoice customer-email snapshot support;
- protected `autopilot_run:*` Recovery Receipt queue rows;
- provider receipt/error fields and deterministic delivery uniqueness;
- privacy-minimized funnel telemetry with `free` mode;
- durable service-side rate limiting;
- service-managed `autopilot_runs` with client-deny RLS;
- signup/Founding compatibility guards required by the recovered TitanOS environment.

Historical paid-era migrations/tables may remain for migration-history compatibility and audit preservation, but they are not active free Autopilot execution dependencies.

Recovery Staging (`wbymywwrpbljfbsemung`) has passed schema, RLS, recipient-integrity, Auth/profile confirmation compatibility, durable-rate-limit, and free-run-ledger probes. Synthetic certification records were removed after testing. This is **database/runtime certification only**, not production launch certification.

## 8. Launch conversion + production checklist

Before a Product Hunt launch/relaunch request:

- direct `/autopilot` opens the public preview without forcing sign-in;
- public preview clearly says Autopilot is free and contains no paid execution CTA;
- public preview remains isolated from `useAuth`, invoice entities, private recovery runners, and the full API client;
- public telemetry never blocks rendering;
- anonymous preview works at iPhone and desktop widths;
- **Create account** and **Sign in** both preserve a sanitized return to `/autopilot`;
- authenticated `/autopilot` resolves to the private Recovery Command Center;
- the `titanos-web` runtime points at the intended TitanOS Supabase project;
- server/client canonical Supabase project refs agree;
- `runAutopilotFree` works without any plan, price, payment, or Stripe entitlement;
- paid Autopilot endpoints return `410` and cannot create charges;
- `node scripts/verify-autopilot-db-security.mjs` passes against the target database;
- authenticated/anonymous clients cannot forge `autopilot_runs` records;
- durable registration/outbound rate limiting is available and `requireDurable: true` remains intact;
- production registration does not fall back to direct hosted Supabase signup;
- `RESEND_API_KEY` and verified `RESEND_FROM` support signup OTP and Autopilot delivery;
- fresh account creation sends the initial six-digit OTP;
- resend issues a fresh product-owned OTP bound to the pending user/email;
- OTP verification creates/preserves a refreshable browser session and returns the Product Hunt visitor to `/autopilot`;
- one-customer-per-sprint enforcement is verified in UI + backend;
- 72-hour repeat-reminder protection is verified across separate run IDs;
- repeat-click, concurrent-run, stale-run, paid-after-approval, recipient-drift, ambiguous-network, provider-receipt, acceptance-reconciliation, and generic-Follow-ups isolation are tested;
- sample/demo information is clearly labeled;
- Maker writes their own first comment;
- gallery tells one coherent story;
- sharing asks for product feedback/discussion, not coordinated or incentivized upvotes.

## 9. Activation telemetry

The first-party `autopilot_funnel_events` table stores only allow-listed coarse metadata: event, source bucket, mode, invoice count, and outcome. It does not store customer names, emails, invoice IDs/numbers, message bodies, raw referrers, IPs, or exact balances.

Active free funnel:

- Product Hunt/direct visitor → `preview_view`;
- preview → `signed_in_view`;
- signed in → `eligible_loaded`;
- eligible → `batch_approved`;
- approved → `free_run_started`;
- execution → `run_completed` / `run_retryable` / `run_failed`.

Historical paid event/mode values remain allow-listed only so old telemetry stays readable; the active UI/server flow does not emit them.

## 10. Monetization policy

Autopilot is **free for now**.

Future advertising may be evaluated later, but this release does **not** include:

- an ad SDK;
- ad placements;
- advertiser tracking;
- customer/invoice data sharing for advertising;
- paid feature gates;
- a checkout or subscription CTA.

Any future ad implementation must be designed as a separate privacy/security project and must not weaken Recovery Receipt integrity, recipient authorization, or transactional-email deliverability.

## 11. No-go conditions

Do not submit/relaunch if any of these are true:

- CI has not actually executed `gate:ship` successfully;
- current-branch hosting/preview is unavailable;
- the production runtime database/project mapping is unverified;
- required free-run/RLS capability is absent;
- any active Autopilot UI or endpoint can create a Stripe Checkout or require a paid plan;
- production registration can silently fall back to hosted Supabase signup;
- durable registration protection can be bypassed when its backend is unavailable;
- signup OTP initial send/resend/verification has not been exercised with deployed credentials;
- the public `/autopilot` preview is unreachable, slow-blocked by auth, or errors on mobile;
- authenticated `/autopilot` does not reach the Recovery Command Center;
- an interrupted/ambiguous run can resend outside the provider-idempotent path;
- a sprint can contact the same normalized customer email more than once;
- the same invoice can be reminded again inside the 72-hour cooldown by starting another sprint;
- generic Follow-ups can edit/delete/send an Autopilot Recovery Receipt;
- a paid invoice can receive a reminder after the final eligibility check;
- provider acceptance can be reported without preserved evidence/reconciliation;
- the listing promises recovery rates or money results Titan has not verified;
- the only meaningful change from the prior launch is visual styling or monetization.

A Product Hunt launch should amplify a production-grade product, not serve as its production test.
