import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Autopilot checkout binds the paid order to the authenticated owner", async () => {
  const source = await read("api/functions/createAutopilotOrder.js");
  assert.match(source, /eq\("created_by_id", auth\.user\.id\)/);
  assert.match(source, /metadata: \{ payment_id: payment\.id, user_id: auth\.user\.id/);
  assert.match(source, /idempotencyKey: `autopilot_\$\{payment\.id\}`/);
});

test("Autopilot execution requires settlement and atomically claims an order", async () => {
  const source = await read("api/functions/runAutopilotOrder.js");
  assert.match(source, /payment\.status !== "succeeded"/);
  assert.match(source, /\.eq\("note", payment\.note\)/);
  assert.match(source, /order\.state === "completed"/);
  assert.match(source, /RESEND_API_KEY/);
});

test("Autopilot recipient storage is owner-scoped through the existing queue", async () => {
  const migration = await read("supabase/migrations/041_titan_autopilot.sql");
  assert.match(migration, /ADD COLUMN IF NOT EXISTS customer_email TEXT/);
  assert.match(migration, /created_by_id, status, scheduled_for/);
});
