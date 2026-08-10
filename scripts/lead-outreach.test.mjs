import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  escapeEmailHtml,
  extractMailbox,
  parseWorkerLeads,
  personalizeOutreach,
  validLeadEmail,
} from "../api/_lib/leadOutreach.js";
import { FEATURES, profileAllowsFeature } from "../shared/entitlements.js";

test("worker results accept valid business emails and reject malformed addresses", () => {
  const rows = parseWorkerLeads('```json\n[{"company":"Acme","email":"hello@acme.com"}]\n```');
  assert.equal(rows.length, 1);
  assert.equal(validLeadEmail(rows[0].email), true);
  assert.equal(validLeadEmail("not-an-email"), false);
});

test("outreach personalization and HTML escaping are safe", () => {
  assert.equal(personalizeOutreach("Hi {{company}}", { company: "Acme" }), "Hi Acme");
  assert.equal(escapeEmailHtml('<script>"x"</script>'), "&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
  assert.equal(extractMailbox("TitanOS <outreach@example.com>"), "outreach@example.com");
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
  assert.match(sendSource, /slice\(0, 25\)/);
  assert.match(sendSource, /\.eq\("created_by_id", auth\.user\.id\)/);
  assert.match(sendSource, /api\.resend\.com\/emails/);
  assert.match(sendSource, /List-Unsubscribe/);
});

test("outreach UI paces all eligible leads in bounded minute batches", async () => {
  const source = await readFile(new URL("../src/pages/LeadOutreach.jsx", import.meta.url), "utf8");
  assert.match(source, /const BATCH_SIZE = 25/);
  assert.match(source, /const BATCH_DELAY_SECONDS = 60/);
  assert.match(source, /queued\.slice\(processed, processed \+ BATCH_SIZE\)/);
  assert.match(source, /Email all ready/);
  assert.match(source, /Keep TitanOS open/);
  assert.match(source, /stopSendingRef/);
});

test("database migration preserves owner-only RLS and outreach indexes", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260810000129_titan_auto_lead_outreach.sql", import.meta.url), "utf8");
  assert.match(sql, /ENABLE ROW LEVEL SECURITY|Existing leads_own policy/i);
  assert.match(sql, /auth\.uid\(\)\) = created_by_id/);
  assert.match(sql, /idx_leads_owner_outreach/);
  assert.match(sql, /outreach_status/);
});
