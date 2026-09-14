import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  AUTOPILOT_RESEND_RETRY_WINDOW_MS,
  autopilotQueueOutcome,
  canRetryAutopilotPending,
} from "../api/_lib/autopilotDelivery.js";
import { classifyAutopilotSource } from "../api/_lib/autopilotFunnel.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Autopilot provider retry window is fail-closed at the boundary", () => {
  const now = Date.parse("2026-09-14T12:00:00.000Z");
  const inside = new Date(now - AUTOPILOT_RESEND_RETRY_WINDOW_MS + 1).toISOString();
  const boundary = new Date(now - AUTOPILOT_RESEND_RETRY_WINDOW_MS).toISOString();

  assert.equal(canRetryAutopilotPending({ status: "pending", created_at: inside }, now), true);
  assert.equal(canRetryAutopilotPending({ status: "pending", created_at: boundary }, now), false);
  assert.equal(canRetryAutopilotPending({ status: "sent", created_at: inside }, now), false);
  assert.equal(canRetryAutopilotPending({ status: "pending", created_at: "not-a-date" }, now), false);
  assert.equal(canRetryAutopilotPending(null, now), false);
});

test("Autopilot queue outcome reconciliation is deterministic", () => {
  assert.equal(autopilotQueueOutcome({ status: "sent" }), "sent");
  assert.equal(autopilotQueueOutcome({ status: "failed" }), "failed");
  assert.equal(autopilotQueueOutcome({ status: "skipped" }), "skipped");
  assert.equal(autopilotQueueOutcome({ status: "pending" }), "pending");
  assert.equal(autopilotQueueOutcome(null), "missing");
});

test("Autopilot Product Hunt attribution is coarse and does not expose the referrer", () => {
  assert.equal(classifyAutopilotSource({ headers: { referer: "https://www.producthunt.com/products/titan-autopilot" } }), "product_hunt");
  assert.equal(classifyAutopilotSource({ headers: { referer: "https://titanos.app/autopilot?utm_source=producthunt" } }), "product_hunt");
  assert.equal(classifyAutopilotSource({ headers: { referer: "https://example.com/post" } }), "other");
  assert.equal(classifyAutopilotSource({ headers: {} }), "direct");
});

test("Autopilot checkout binds the paid order to the authenticated owner", async () => {
  const source = await read("api/functions/createAutopilotOrder.js");
  assert.match(source, /eq\("created_by_id", auth\.user\.id\)/);
  assert.match(source, /metadata: \{ payment_id: payment\.id, user_id: auth\.user\.id/);
  assert.match(source, /task_type: "invoice_recovery_sprint"/);
  assert.match(source, /idempotencyKey: `autopilot_\$\{payment\.id\}`/);
  assert.match(source, /eventName: "checkout_started"/);
});

test("Autopilot validates the configured Stripe price before creating a payable order", async () => {
  const source = await read("api/functions/createAutopilotOrder.js");
  assert.match(source, /stripe\.prices\.retrieve\(configuredPriceId\)/);
  assert.match(source, /price\?\.active === true/);
  assert.match(source, /price\?\.type === "one_time"/);
  assert.match(source, /String\(price\?\.currency \|\| ""\)\.toLowerCase\(\) === "usd"/);
  assert.match(source, /Number\(price\?\.unit_amount\) === SPRINT_PRICE_CENTS/);
  assert.match(source, /AUTOPILOT_PRICE_MISCONFIGURED/);
});

test("Autopilot enforces one normalized customer email per new sprint", async () => {
  const checkout = await read("api/functions/createAutopilotOrder.js");
  const membership = await read("api/functions/runAutopilotMembership.js");
  const ui = await read("src/pages/Autopilot.jsx");

  assert.match(checkout, /hasDuplicateRecipients\(invoices\)/);
  assert.match(checkout, /one overdue invoice per customer email/);
  assert.match(membership, /hasDuplicateRecipients\(requestedInvoices\)/);
  assert.match(membership, /one overdue invoice per customer email/);
  assert.match(ui, /uniqueEligibleCount/);
  assert.match(ui, /Customer already selected/);
  assert.match(ui, /one invoice per customer email in each sprint/);
  assert.match(ui, /Select oldest .* customers/);
});

test("Stripe webhook settles Autopilot only after verified paid checkout", async () => {
  const source = await read("api/functions/stripeWebhook.js");
  assert.match(source, /constructEvent/);
  assert.match(source, /metadata\.task_type === "invoice_recovery_sprint"/);
  assert.match(source, /session\.payment_status !== "paid"/);
  assert.match(source, /Autopilot payment owner mismatch/);
  assert.match(source, /Autopilot checkout session mismatch/);
  assert.match(source, /Autopilot checkout amount mismatch/);
  assert.match(source, /status: "succeeded"/);
});

test("Autopilot execution requires settlement and atomically claims an order", async () => {
  const source = await read("api/functions/runAutopilotOrder.js");
  assert.match(source, /payment\.status !== "succeeded"/);
  assert.match(source, /\.eq\("note", payment\.note\)/);
  assert.match(source, /order\.state === "completed"/);
  assert.match(source, /RESEND_API_KEY/);
});

test("Shared Autopilot delivery engine records provider evidence and uses stable idempotency", async () => {
  const helper = await read("api/_lib/autopilotDelivery.js");
  const migration = await read("supabase/migrations/20260914130000_autopilot_delivery_idempotency.sql");
  assert.match(helper, /AUTOPILOT_RESEND_RETRY_WINDOW_MS/);
  assert.match(helper, /canRetryAutopilotPending/);
  assert.match(helper, /autopilotQueueOutcome/);
  assert.match(helper, /readAutopilotQueue/);
  assert.match(helper, /"Idempotency-Key": deliveryKey/);
  assert.match(helper, /provider_message_id: providerMessageId/);
  assert.match(helper, /delivery_error_code/);
  assert.match(helper, /concurrent_idempotent_requests/);
  assert.match(helper, /network_ambiguous/);
  assert.match(helper, /provider_accepted_receipt_persist_ambiguous/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS provider_message_id TEXT/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS delivery_error_code TEXT/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_followup_autopilot_run_once/);
  assert.match(migration, /rule_id LIKE 'autopilot_run:%'/);
});

test("Autopilot order execution is crash-recoverable at DB, lease, and provider layers", async () => {
  const source = await read("api/functions/runAutopilotOrder.js");
  assert.match(source, /STALE_RUN_MS/);
  assert.match(source, /isFreshRun\(order\)/);
  assert.match(source, /canRetryAutopilotPending\(prior\)/);
  assert.match(source, /deliverAutopilotQueue/);
  assert.match(source, /readAutopilotQueue/);
  assert.match(source, /autopilotQueueOutcome/);
  assert.match(source, /autopilot_run:order:/);
  assert.match(source, /delivery_unconfirmed_invoice_no_longer_eligible/);
  assert.match(source, /idempotency_window_expired/);
  assert.match(source, /\.eq\("note", runningNote\)/);
  assert.match(source, /state: pending > 0 \? "retryable" : "completed"/);
  assert.match(source, /res\.status\(pending > 0 \? 202 : 200\)/);
});

test("Autopilot one-time runner re-reads invoice eligibility immediately before first delivery", async () => {
  const source = await read("api/functions/runAutopilotOrder.js");
  assert.match(source, /Re-read immediately before creating the delivery/);
  assert.match(source, /freshInvoice/);
  assert.match(source, /isStillEligible\(freshInvoice, today\)/);
  assert.match(source, /status: "skipped"/);
});

test("Autopilot recipient storage is owner-scoped through the existing queue", async () => {
  const migration = await read("supabase/migrations/041_titan_autopilot.sql");
  assert.match(migration, /ADD COLUMN IF NOT EXISTS customer_email TEXT/);
  assert.match(migration, /created_by_id, status, scheduled_for/);
});

test("Membership sprint enforces paid entitlement, ownership, and monthly replay protection", async () => {
  const source = await read("api/functions/runAutopilotMembership.js");
  const migration = await read("supabase/migrations/042_autopilot_membership_claims.sql");
  assert.match(source, /paying_subscriber === true/);
  assert.match(source, /eq\("created_by_id", auth\.user\.id\)/);
  assert.match(source, /claimError\?\.code === "23505"/);
  assert.match(migration, /UNIQUE \(user_id, period_key\)/);
  assert.match(migration, /REVOKE ALL .* FROM anon, authenticated/);
});

test("Membership stale recovery preserves and reconciles the original approved batch", async () => {
  const source = await read("api/functions/runAutopilotMembership.js");
  assert.match(source, /readMonthlyClaim/);
  assert.match(source, /existing\.invoice_ids/);
  assert.match(source, /originalInvoiceIds/);
  assert.match(source, /invoice_ids: originalInvoiceIds/);
  assert.match(source, /if \(!existingClaim\)/);
  assert.match(source, /Recovery always uses the original approved monthly batch/);
  assert.match(source, /effectiveInvoiceIds/);
  assert.match(source, /readAutopilotQueue/);
  assert.match(source, /autopilotQueueOutcome/);
  assert.match(source, /queue_reconcile_missing/);
});

test("Membership recovery uses the shared provider engine and a compare-and-set lease", async () => {
  const source = await read("api/functions/runAutopilotMembership.js");
  assert.match(source, /STALE_RUN_MS/);
  assert.match(source, /isFreshRun\(existingClaim\)/);
  assert.match(source, /canRetryAutopilotPending\(prior\)/);
  assert.match(source, /deliverAutopilotQueue/);
  assert.match(source, /autopilot_run:membership:/);
  assert.match(source, /recovered: acquired\.recovered/);
  assert.match(source, /\.eq\("updated_at", claim\.updated_at\)/);
  assert.match(source, /retryRequired/);
  assert.match(source, /res\.status\(retryRequired \? 202 : 200\)/);
});

test("Membership sprint prepares an auditable queue when email delivery is unavailable", async () => {
  const source = await read("api/functions/runAutopilotMembership.js");
  assert.match(source, /prepared \+= 1/);
  assert.match(source, /if \(!resendKey\)/);
  assert.match(source, /delivery_mode: resendKey \? "email" : "review_queue"/);
});

test("Autopilot queue rows are protected from generic follow-up send, mutation, and deletion", async () => {
  const sender = await read("api/functions/sendFollowUp.js");
  const client = await read("src/lib/followUpApi.js");
  const rls = await read("supabase/migrations/20260914194500_autopilot_queue_rls.sql");
  const page = await read("src/pages/FollowUps.jsx");

  assert.match(sender, /AUTOPILOT_QUEUE_PROTECTED/);
  assert.match(sender, /startsWith\("autopilot_run:"\)/);
  assert.match(client, /isAutopilotFollowUp/);
  assert.match(client, /managed by Titan Autopilot/);
  assert.doesNotMatch(client, /catch \{\s*return markQueueSent/);
  assert.match(rls, /DROP POLICY IF EXISTS follow_queue_own/);
  assert.match(rls, /FOR UPDATE/);
  assert.match(rls, /FOR DELETE/);
  assert.match(rls, /NOT LIKE 'autopilot_run:%'/);
  assert.match(page, /Autopilot Recovery Receipts/);
  assert.match(page, /read-only evidence/);
  assert.match(page, /normalPending/);
});

test("Autopilot funnel telemetry is allow-listed, coarse, client-write protected, and non-blocking", async () => {
  const helper = await read("api/_lib/autopilotFunnel.js");
  const endpoint = await read("api/functions/trackAutopilotEvent.js");
  const client = await read("src/lib/autopilotTelemetry.js");
  const page = await read("src/pages/Autopilot.jsx");
  const order = await read("api/functions/runAutopilotOrder.js");
  const membership = await read("api/functions/runAutopilotMembership.js");
  const migration = await read("supabase/migrations/20260914193000_autopilot_funnel_events.sql");

  assert.match(helper, /product_hunt/);
  assert.match(helper, /safeInvoiceCount/);
  assert.match(endpoint, /requireDurable: true/);
  assert.match(client, /titan_autopilot_source/);
  assert.match(client, /stored === "product_hunt"/);
  assert.match(page, /preview_view/);
  assert.match(page, /signed_in_view/);
  assert.match(page, /eligible_loaded/);
  assert.match(page, /batch_approved/);
  assert.match(page, /checkout_returned/);
  assert.match(order, /one_time_run_started/);
  assert.match(order, /eventName: pending > 0 \? "run_retryable" : "run_completed"/);
  assert.match(membership, /membership_run_started/);
  assert.match(membership, /eventName: retryRequired \? "run_retryable"/);
  assert.match(migration, /REVOKE ALL ON public\.autopilot_funnel_events FROM anon, authenticated/);
  assert.match(migration, /invoice_count INTEGER/);
  assert.doesNotMatch(migration, /customer_email/);
  assert.doesNotMatch(migration, /invoice_number/);
  assert.doesNotMatch(migration, /message_body/);
  assert.doesNotMatch(migration, /raw_referrer/);
});

test("Autopilot UI is explicit about settlement, safe retries, Recovery Receipts, and paid tier compatibility", async () => {
  const source = await read("src/pages/Autopilot.jsx");
  assert.match(source, /Recovery Command Center/);
  assert.match(source, /Example preview · sample data/);
  assert.match(source, /Paid-after-approval safety stop/);
  assert.match(source, /Reminder preview/);
  assert.match(source, /Select oldest/);
  assert.match(source, /not guaranteed recovered revenue/);
  assert.match(source, /Checkout complete — verifying payment/);
  assert.match(source, /Returning from Stripe does not unlock delivery by itself/);
  assert.match(source, /Safe retry required/);
  assert.match(source, /View Recovery Receipts/);
  assert.match(source, /"worker_premium", "pro", "business"/);
});
