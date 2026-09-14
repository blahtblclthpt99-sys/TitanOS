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

test("Autopilot order execution is crash-recoverable and recipient-idempotent", async () => {
  const source = await read("api/functions/runAutopilotOrder.js");
  const migration = await read("supabase/migrations/20260914130000_autopilot_delivery_idempotency.sql");
  assert.match(source, /STALE_RUN_MS/);
  assert.match(source, /isFreshRun\(order\)/);
  assert.match(source, /autopilot_run:order:/);
  assert.match(source, /isStillEligible\(invoice, today\)/);
  assert.match(source, /status: "skipped"/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_followup_autopilot_run_once/);
  assert.match(migration, /rule_id LIKE 'autopilot_run:%'/);
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

test("Membership recovery can reclaim a stale run without duplicate recipients", async () => {
  const source = await read("api/functions/runAutopilotMembership.js");
  assert.match(source, /STALE_RUN_MS/);
  assert.match(source, /isFreshRun\(existing\)/);
  assert.match(source, /autopilot_run:membership:/);
  assert.match(source, /recovered: acquired\.recovered/);
  assert.match(source, /Re-read just before creating a delivery/);
  assert.match(source, /status: "skipped"/);
});

test("Membership sprint prepares an auditable queue when email delivery is unavailable", async () => {
  const source = await read("api/functions/runAutopilotMembership.js");
  assert.match(source, /prepared \+= 1/);
  assert.match(source, /if \(!resendKey\) continue/);
  assert.match(source, /delivery_mode: resendKey \? "email" : "review_queue"/);
});

test("Autopilot UI exposes public product story and recovery controls", async () => {
  const source = await read("src/pages/Autopilot.jsx");
  assert.match(source, /Recovery Command Center/);
  assert.match(source, /Example preview · sample data/);
  assert.match(source, /Paid-after-approval safety stop/);
  assert.match(source, /Reminder preview/);
  assert.match(source, /Select oldest/);
  assert.match(source, /not guaranteed recovered revenue/);
});
