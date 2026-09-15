import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("invoice recipient snapshot is derived only from an owner-matched customer", async () => {
  const migration = await read("supabase/migrations/20260914210000_autopilot_recipient_snapshot.sql");

  assert.match(migration, /ALTER TABLE public\.invoices[\s\S]*ADD COLUMN IF NOT EXISTS customer_email TEXT/);
  assert.match(migration, /c\.id::text = i\.customer_id/);
  assert.match(migration, /c\.created_by_id = i\.created_by_id/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.snapshot_invoice_customer_email/);
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /c\.created_by_id = NEW\.created_by_id/);
  assert.match(migration, /NEW\.customer_email := NULL/);
  assert.match(migration, /BEFORE INSERT OR UPDATE OF customer_id, created_by_id/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.snapshot_invoice_customer_email\(\) FROM PUBLIC, anon, authenticated/);
});

test("one-time checkout persists the exact approved recipient list in approval order", async () => {
  const checkout = await read("api/functions/createAutopilotOrder.js");

  assert.match(checkout, /const orderedInvoices = invoiceIds\.map/);
  assert.match(checkout, /const approvedRecipients = orderedInvoices\.map/);
  assert.match(checkout, /invoice_id: String\(invoice\.id\)/);
  assert.match(checkout, /customer_email: recipientKey\(invoice\.customer_email\)/);
  assert.match(checkout, /approved_recipients: approvedRecipients/);
  assert.match(checkout, /recipient_snapshot_version: 1/);
  assert.match(checkout, /\.eq\("note", `AUTOPILOT:\$\{JSON\.stringify\(orderData\)\}`\)/);
});

test("one-time execution fails closed without approval evidence and stops recipient drift", async () => {
  const runner = await read("api/functions/runAutopilotOrder.js");

  assert.match(runner, /function approvedRecipientMap\(order\)/);
  assert.match(runner, /recipient_snapshot_version !== 1/);
  assert.match(runner, /AUTOPILOT_RECIPIENT_SNAPSHOT_REQUIRED/);
  assert.match(runner, /approved_recipient_mismatch/);
  assert.match(runner, /approved_recipient_changed/);
  assert.match(runner, /normalizeEmail\(freshForRetry\?\.customer_email\) !== approvedEmail/);
  assert.match(runner, /customer_email: approvedEmail/);
});

test("monthly recovery preserves the exact approved invoice-email snapshot", async () => {
  const migration = await read("supabase/migrations/20260914210000_autopilot_recipient_snapshot.sql");
  const membership = await read("api/functions/runAutopilotMembership.js");

  assert.match(migration, /ADD COLUMN IF NOT EXISTS recipient_snapshot JSONB NOT NULL DEFAULT '\[\]'::jsonb/);
  assert.match(migration, /jsonb_typeof\(recipient_snapshot\) = 'array'/);
  assert.match(membership, /function buildRecipientSnapshot\(invoiceIds, invoices\)/);
  assert.match(membership, /function approvedRecipientMap\(invoiceIds, snapshot\)/);
  assert.match(membership, /recipient_snapshot: requestedRecipientSnapshot/);
  assert.match(membership, /recipient_snapshot: existing\.recipient_snapshot/);
  assert.match(membership, /exact original approved recipients are unavailable/);
  assert.match(membership, /AUTOPILOT_RECIPIENT_SNAPSHOT_REQUIRED/);
  assert.match(membership, /approved_recipient_mismatch/);
  assert.match(membership, /approved_recipient_changed/);
  assert.match(membership, /customer_email: approvedEmail/);
});

test("recipient contract never infers a replacement address during recovery", async () => {
  const order = await read("api/functions/runAutopilotOrder.js");
  const membership = await read("api/functions/runAutopilotMembership.js");

  assert.match(order, /Create a new sprint so the recipients can be approved again/);
  assert.match(membership, /Titan will not infer replacement recipients/);
  assert.doesNotMatch(order, /approvedEmail\s*=\s*normalizeEmail\(fresh/);
  assert.doesNotMatch(membership, /approvedEmail\s*=\s*recipientKey\(fresh/);
});
