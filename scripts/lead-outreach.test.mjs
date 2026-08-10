import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  createUnsubscribeToken,
  escapeEmailHtml,
  extractMailbox,
  outreachIdempotencyKey,
  parseWorkerLeads,
  personalizeOutreach,
  validLeadEmail,
  verifyResendWebhook,
  verifyUnsubscribeToken,
} from "../api/_lib/leadOutreach.js";
import { FEATURES, profileAllowsFeature } from "../shared/entitlements.js";

test("worker results accept valid business emails and reject malformed addresses", () => {
  const rows = parseWorkerLeads('```json\n[{"company":"Acme","email":"hello@acme.com"}]\n```');
  assert.equal(rows.length, 1);
  assert.equal(validLeadEmail(rows[0].email), true);
  assert.equal(validLeadEmail("not-an-email"), false);
});

test("Resend webhooks require a current valid Svix signature", () => {
  const secretBytes = Buffer.from("resend-test-secret");
  const secret = `whsec_${secretBytes.toString("base64")}`;
  const id = "msg_test";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const payload = JSON.stringify({ type: "email.bounced" });
  const signature = createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${payload}`).digest("base64");
  assert.equal(verifyResendWebhook({ id, timestamp, signature: `v1,${signature}`, payload }, secret), true);
  assert.equal(verifyResendWebhook({ id, timestamp, signature: "v1,bad", payload }, secret), false);
});

test("outreach personalization and HTML escaping are safe", () => {
  assert.equal(personalizeOutreach("Hi {{company}}", { company: "Acme" }), "Hi Acme");
  assert.equal(escapeEmailHtml('<script>"x"</script>'), "&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
  assert.equal(extractMailbox("TitanOS <outreach@example.com>"), "outreach@example.com");
});

test("unsubscribe tokens are signed, scoped, and reject tampering", () => {
  const secret = "test-secret-that-is-never-used-in-production";
  const token = createUnsubscribeToken({ leadId: "lead-1", ownerId: "owner-1", email: "HELLO@ACME.COM" }, secret);
  assert.deepEqual(verifyUnsubscribeToken(token, secret), { v: 1, leadId: "lead-1", ownerId: "owner-1", email: "hello@acme.com" });
  assert.equal(verifyUnsubscribeToken(`${token}x`, secret), null);
  assert.match(outreachIdempotencyKey("lead-1", "Pilot"), /^titan-outreach\/lead-1\/[a-f0-9]{20}$/);
});

test("lead workers are premium-only while owner and admin retain access", () => {
  assert.equal(profileAllowsFeature({ plan_tier: "worker_free" }, FEATURES.leadOutreach), false);
  assert.equal(profileAllowsFeature({ plan_tier: "starter" }, FEATURES.leadOutreach), false);
  assert.equal(profileAllowsFeature({ plan_tier: "worker_premium" }, FEATURES.leadOutreach), true);
  assert.equal(profileAllowsFeature({ plan_tier: "worker_free", role: "admin" }, FEATURES.leadOutreach), true);
  assert.equal(profileAllowsFeature({ plan_tier: "worker_free" }, FEATURES.leadOutreach, { email: "mlafferty1991@yahoo.com" }), true);
});

test("API handlers require auth, ownership, compliance, and bounded sends", async () => {
  const findSource = await readFile(new URL("../api/functions/leadWorkerFind.js", import.meta.url), "utf8");
  const sendSource = await readFile(new URL("../api/functions/leadWorkerSend.js", import.meta.url), "utf8");
  assert.match(findSource, /requireUser\(req, res\)/);
  assert.match(findSource, /requireFeature\(res, auth\.admin, auth\.user, FEATURES\.leadOutreach\)/);
  assert.match(findSource, /assertRateLimitAsync/);
  assert.match(findSource, /created_by_id/);
  assert.match(sendSource, /requireUser\(req, res\)/);
  assert.match(sendSource, /requireFeature\(res, auth\.admin, auth\.user, FEATURES\.leadOutreach\)/);
  assert.match(sendSource, /confirmCompliant !== true/);
  assert.match(sendSource, /const MAX_BATCH = 5/);
  assert.match(sendSource, /\.eq\("created_by_id", auth\.user\.id\)/);
  assert.match(sendSource, /api\.resend\.com\/emails/);
  assert.match(sendSource, /List-Unsubscribe/);
  assert.match(sendSource, /List-Unsubscribe-Post/);
  assert.match(sendSource, /Idempotency-Key/);
  assert.match(sendSource, /OUTREACH_POSTAL_ADDRESS/);
  assert.match(sendSource, /RESEND_WEBHOOK_SECRET/);
  assert.match(sendSource, /email_quality_status !== "verified"/);
});

test("outreach UI limits the launch pilot to verified leads", async () => {
  const source = await readFile(new URL("../src/pages/LeadOutreach.jsx", import.meta.url), "utf8");
  assert.match(source, /const BATCH_SIZE = 5/);
  assert.match(source, /const BATCH_DELAY_SECONDS = 60/);
  assert.match(source, /queued\.slice\(processed, processed \+ BATCH_SIZE\)/);
  assert.match(source, /Select verified pilot/);
  assert.match(source, /email_quality_status === "verified"/);
  assert.match(source, /stopSendingRef/);
});

test("database migration preserves owner-only RLS and outreach indexes", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260810000129_titan_auto_lead_outreach.sql", import.meta.url), "utf8");
  assert.match(sql, /ENABLE ROW LEVEL SECURITY|Existing leads_own policy/i);
  assert.match(sql, /auth\.uid\(\)\) = created_by_id/);
  assert.match(sql, /idx_leads_owner_outreach/);
  assert.match(sql, /outreach_status/);
});

test("hardening migration stores quality, suppression, and webhook deduplication", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260810034332_harden_lead_outreach.sql", import.meta.url), "utf8");
  assert.match(sql, /email_quality_status/);
  assert.match(sql, /suppression_reason/);
  assert.match(sql, /lead_outreach_webhook_events/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL.*anon, authenticated/);
});
