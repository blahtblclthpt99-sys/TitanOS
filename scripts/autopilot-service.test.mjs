import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Titan Auto checkout uses a server-owned order claim and stable Stripe identity", async () => {
  const source = await read("api/functions/createAutopilotOrder.js");
  assert.match(source, /claim_titan_auto_order/);
  assert.match(source, /checkoutKeyFor\(invoiceIds\)/);
  assert.match(source, /payment_id: String\(claim\.payment_id\)/);
  assert.match(source, /order_id: String\(claim\.order_id\)/);
  assert.match(source, /user_id: String\(auth\.user\.id\)/);
  assert.match(source, /payment_intent_data: \{ metadata: reconciliationMetadata \}/);
  assert.match(source, /idempotencyKey: `autopilot_\$\{claim\.payment_id\}`/);
  assert.match(source, /PAYMENT_RECONCILIATION_REQUIRED/);
});

test("Titan Auto checkout validates the configured Stripe price as exactly $9 USD one-time", async () => {
  const source = await read("api/functions/createAutopilotOrder.js");
  assert.match(source, /stripe\.prices\.retrieve\(configuredPriceId\)/);
  assert.match(source, /String\(price\?\.currency \|\| ""\)\.toLowerCase\(\) === "usd"/);
  assert.match(source, /Number\(price\?\.unit_amount\) === SPRINT_PRICE_CENTS/);
  assert.match(source, /price\?\.type === "one_time"/);
  assert.match(source, /AUTOPILOT_PRICE_MISMATCH/);
});

test("Titan Auto checkout snapshots the approved recipient and revalidates invoice accounting", async () => {
  const source = await read("api/functions/createAutopilotOrder.js");
  assert.match(source, /amount_paid/);
  assert.match(source, /Math\.abs\(stored - due\) <= 0\.01/);
  assert.match(source, /approvedRecipients/);
  assert.match(source, /p_approved_recipients: approvedRecipients/);

  const migration = await read("supabase/migrations/20260910084000_autopilot_recipient_snapshot.sql");
  assert.match(migration, /approved_recipients JSONB NOT NULL/);
  assert.match(migration, /autopilot_recipient_count_mismatch/);
  assert.match(migration, /autopilot_recipient_missing/);
  assert.match(migration, /v_order\.approved_recipients IS DISTINCT FROM p_approved_recipients/);
});

test("Titan Auto paid execution authority is server-only and no longer controlled by payments.note", async () => {
  const migration = await read("supabase/migrations/20260910081500_autopilot_checkout_execution_integrity.sql");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.titan_auto_orders/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.titan_auto_delivery_receipts/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.titan_auto_orders FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.titan_auto_delivery_receipts FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /UNIQUE \(order_id, invoice_id\)/);
  assert.match(migration, /checkout_source = 'titan_auto_sprint'/);

  const executionMigration = await read("supabase/migrations/20260910083000_autopilot_execution_claim.sql");
  assert.match(executionMigration, /COALESCE\(OLD\.note, ''\) LIKE 'AUTOPILOT:%'/);
  assert.match(executionMigration, /NEW\.note := OLD\.note/);
  assert.match(executionMigration, /CREATE OR REPLACE FUNCTION public\.claim_titan_auto_execution/);
  assert.match(executionMigration, /v_payment\.status IS DISTINCT FROM 'succeeded'/);
  assert.match(executionMigration, /lease_expires_at > v_now/);
  assert.match(executionMigration, /interval '15 minutes'/);
  assert.match(executionMigration, /REVOKE ALL ON FUNCTION public\.claim_titan_auto_execution[\s\S]*FROM authenticated/);
  assert.match(executionMigration, /GRANT EXECUTE ON FUNCTION public\.claim_titan_auto_execution[\s\S]*TO service_role/);
});

test("Titan Auto execution uses delivery receipts and provider idempotency for retry-safe side effects", async () => {
  const source = await read("api/functions/runAutopilotOrder.js");
  assert.match(source, /payment\.status !== "succeeded"/);
  assert.match(source, /claim_titan_auto_execution/);
  assert.match(source, /titan_auto_delivery_receipts/);
  assert.match(source, /receipt\.status === "sent"/);
  assert.match(source, /receipt\.status === "sending"/);
  assert.match(source, /SAFE_RESEND_RETRY_MS = 23 \* 60 \* 60 \* 1000/);
  assert.match(source, /"Idempotency-Key": `titan-auto\/\$\{order\.id\}\/\$\{invoice\.id\}`/);
  assert.match(source, /status: "needs_review"/);
  assert.match(source, /state: "retryable"/);
  assert.match(source, /EMAIL_DELIVERY_NOT_CONFIGURED/);
});

test("Titan Auto execution uses the approved recipient snapshot while rechecking current invoice state", async () => {
  const source = await read("api/functions/runAutopilotOrder.js");
  assert.match(source, /const approvedRecipients = order\.approved_recipients \|\| \{\}/);
  assert.match(source, /const recipient = String\(approvedRecipients\[invoiceId\] \|\| ""\)\.trim\(\)/);
  assert.match(source, /invoiceDecision\(invoice, today\)/);
  assert.match(source, /invoice_balance_inconsistent/);
  assert.match(source, /invoice_not_payable/);
});

test("Titan Auto execution recovers interrupted leases instead of permanently stranding paid orders", async () => {
  const source = await read("api/functions/runAutopilotOrder.js");
  assert.match(source, /let claimedOrderId = null/);
  assert.match(source, /if \(claimedOrderId\)/);
  assert.match(source, /state: "retryable"/);
  assert.match(source, /Execution interrupted/);
  assert.match(source, /lease_recovery_failed/);
});

test("Autopilot recipient storage remains owner-scoped through the existing queue", async () => {
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

test("Membership sprint prepares an auditable queue when email delivery is unavailable", async () => {
  const source = await read("api/functions/runAutopilotMembership.js");
  assert.match(source, /prepared \+= 1/);
  assert.match(source, /if \(!resendKey\) continue/);
  assert.match(source, /delivery_mode: resendKey \? "email" : "review_queue"/);
});
