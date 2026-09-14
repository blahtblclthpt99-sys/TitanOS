import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Autopilot checkout binds the paid order to the authenticated owner", async () => {
  const source = await read("api/functions/createAutopilotOrder.js");
  assert.match(source, /eq\("created_by_id", auth\.user\.id\)/);
  assert.match(source, /metadata: \{ payment_id: payment\.id, user_id: auth\.user\.id/);
  assert.match(source, /task_type: "invoice_recovery_sprint"/);
  assert.match(source, /idempotencyKey: `autopilot_\$\{payment\.id\}`/);
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
  assert.match(helper, /"Idempotency-Key": deliveryKey/);
  assert.match(helper, /provider_message_id: providerMessageId/);
  assert.match(helper, /delivery_error_code/);
  assert.match(helper, /concurrent_idempotent_requests/);
  assert.match(helper, /network_ambiguous/);
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

test("Membership stale recovery preserves the original approved batch", async () => {
  const source = await read("api/functions/runAutopilotMembership.js");
  assert.match(source, /existing\.invoice_ids/);
  assert.match(source, /originalInvoiceIds/);
  assert.match(source, /invoice_ids: originalInvoiceIds/);
  assert.match(source, /effectiveInvoiceIds/);
});

test("Membership recovery uses the shared provider engine and a compare-and-set lease", async () => {
  const source = await read("api/functions/runAutopilotMembership.js");
  assert.match(source, /STALE_RUN_MS/);
  assert.match(source, /isFreshRun\(existing\)/);
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

test("Autopilot UI is explicit about settlement, safe retries, and paid tier compatibility", async () => {
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
  assert.match(source, /"worker_premium", "pro", "business"/);
});
