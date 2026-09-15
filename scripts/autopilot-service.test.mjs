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

test("Autopilot provider retry window fails closed at the boundary", () => {
  const now = Date.parse("2026-09-15T07:00:00.000Z");
  const inside = new Date(now - AUTOPILOT_RESEND_RETRY_WINDOW_MS + 1).toISOString();
  const boundary = new Date(now - AUTOPILOT_RESEND_RETRY_WINDOW_MS).toISOString();
  assert.equal(canRetryAutopilotPending({ status: "pending", created_at: inside }, now), true);
  assert.equal(canRetryAutopilotPending({ status: "pending", created_at: boundary }, now), false);
  assert.equal(canRetryAutopilotPending({ status: "sent", created_at: inside }, now), false);
  assert.equal(canRetryAutopilotPending(null, now), false);
});

test("Autopilot queue outcome reconciliation is deterministic", () => {
  assert.equal(autopilotQueueOutcome({ status: "sent" }), "sent");
  assert.equal(autopilotQueueOutcome({ status: "failed" }), "failed");
  assert.equal(autopilotQueueOutcome({ status: "skipped" }), "skipped");
  assert.equal(autopilotQueueOutcome({ status: "pending" }), "pending");
  assert.equal(autopilotQueueOutcome(null), "missing");
});

test("Product Hunt attribution remains coarse", () => {
  assert.equal(classifyAutopilotSource({ headers: { referer: "https://www.producthunt.com/products/titan-autopilot" } }), "product_hunt");
  assert.equal(classifyAutopilotSource({ headers: { referer: "https://example.com/post" } }), "other");
  assert.equal(classifyAutopilotSource({ headers: {} }), "direct");
});

test("Autopilot paid entrypoints are retired and cannot create charges", async () => {
  for (const path of ["api/functions/createAutopilotOrder.js", "api/functions/runAutopilotOrder.js", "api/functions/runAutopilotMembership.js"]) {
    const source = await read(path);
    assert.match(source, /res\.status\(410\)/);
    assert.doesNotMatch(source, /new Stripe|stripe\.checkout|stripe\.prices|SPRINT_PRICE_CENTS/);
  }
  assert.match(await read("api/functions/createAutopilotOrder.js"), /AUTOPILOT_PAID_CHECKOUT_RETIRED/);
});

test("free Autopilot runner has no payment or subscription entitlement dependency", async () => {
  const source = await read("api/functions/runAutopilotFree.js");
  assert.match(source, /requireUser/);
  assert.match(source, /key: "runAutopilotFree"/);
  assert.match(source, /requireDurable: true/);
  assert.match(source, /AUTOPILOT_DELIVERY_NOT_CONFIGURED/);
  assert.match(source, /\.from\("autopilot_runs"\)/);
  assert.match(source, /eventName: "free_run_started"/);
  assert.match(source, /mode: "free"/);
  assert.doesNotMatch(source, /Stripe|checkout|paying_subscriber|plan_tier|price_cents|payments/);
});

test("free runner validates IDs, snapshots exact recipients, and enforces one customer per sprint", async () => {
  const source = await read("api/functions/runAutopilotFree.js");
  const ui = await read("src/pages/Autopilot.jsx");
  assert.match(source, /UUID_RE/);
  assert.match(source, /requestedInvoiceIds\.some\(\(id\) => !UUID_RE\.test\(id\)\)/);
  assert.match(source, /One or more invoice IDs are invalid/);
  assert.match(source, /buildRecipientSnapshot/);
  assert.match(source, /approvedRecipientMap/);
  assert.match(source, /hasDuplicateRecipients\(ordered\)/);
  assert.match(source, /one overdue invoice per customer email/);
  assert.match(source, /\.eq\("created_by_id", auth\.user\.id\)/);
  assert.match(ui, /uniqueEligibleCount/);
  assert.match(ui, /Customer already selected/);
  assert.match(ui, /one invoice per customer email in each sprint/);
});

test("free runner is crash-safe and retries the original run snapshot", async () => {
  const source = await read("api/functions/runAutopilotFree.js");
  assert.match(source, /const requestedRunId = String\(body\.run_id/);
  assert.match(source, /readRun\(admin, ownerId, requestedRunId\)/);
  assert.match(source, /isFreshRunning/);
  assert.match(source, /existing\.recipient_snapshot/);
  assert.match(source, /lease: reclaimed\.updated_at \|\| requestedLease/);
  assert.match(source, /canRetryAutopilotPending\(prior\)/);
  assert.match(source, /provider_idempotency_window_expired/);
  assert.match(source, /autopilot_run:free:\$\{run\.id\}:\$\{invoiceId\}/);
  assert.match(source, /deliverAutopilotQueue/);
  assert.match(source, /\.eq\("updated_at", lease\)/);
  assert.match(source, /res\.status\(retryable \? 202 : 200\)/);
});

test("free runner rechecks eligibility and recipient immediately before delivery", async () => {
  const source = await read("api/functions/runAutopilotFree.js");
  assert.match(source, /const recipientChanged = recipientKey\(fresh\) !== approvedEmail/);
  assert.match(source, /!isStillEligible\(fresh, today\) \|\| recipientChanged/);
  assert.match(source, /approved_recipient_changed/);
  assert.match(source, /invoice_no_longer_eligible/);
  assert.match(source, /status: "skipped"/);
});

test("new free deliveries are atomically serialized per owner and invoice", async () => {
  const source = await read("api/functions/runAutopilotFree.js");
  const migration = await read("supabase/migrations/20260915043000_autopilot_invoice_delivery_guard.sql");
  const reclaim = await read("supabase/migrations/20260915050000_autopilot_guard_same_run_reclaim.sql");
  assert.match(source, /claim_autopilot_invoice_delivery/);
  assert.match(source, /release_autopilot_invoice_delivery/);
  assert.match(source, /claimInvoiceDelivery\(auth\.admin, auth\.user\.id, invoiceId, run\.id, deliveryKey\)/);
  assert.match(source, /autopilot_delivery_in_progress/);
  assert.match(source, /recent_autopilot_reminder/);
  assert.match(source, /72-hour safety window/);
  assert.match(source, /persisted pending Receipt now protects this invoice/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.autopilot_invoice_delivery_guards/);
  assert.match(migration, /PRIMARY KEY \(user_id, invoice_id\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /INTERVAL '72 hours'/);
  assert.match(migration, /INTERVAL '23 hours'/);
  assert.match(migration, /INTERVAL '5 minutes'/);
  assert.match(migration, /'recent_sent'/);
  assert.match(migration, /'pending_delivery'/);
  assert.match(migration, /'active_reservation'/);
  assert.match(migration, /REVOKE ALL ON public\.autopilot_invoice_delivery_guards FROM anon, authenticated/);
  assert.match(migration, /TO service_role/);
  assert.match(reclaim, /v_guard\.run_id = p_run_id AND v_guard\.delivery_key = v_delivery_key/);
  assert.match(reclaim, /'reclaimed_same_run'/);
  assert.match(reclaim, /'active_reservation'/);
  assert.match(reclaim, /REVOKE ALL ON FUNCTION public\.claim_autopilot_invoice_delivery/);
  assert.match(reclaim, /TO service_role/);
});

test("shared delivery engine preserves provider evidence and deterministic idempotency", async () => {
  const helper = await read("api/_lib/autopilotDelivery.js");
  const migration = await read("supabase/migrations/20260914130000_autopilot_delivery_idempotency.sql");
  assert.match(helper, /"Idempotency-Key": deliveryKey/);
  assert.match(helper, /provider_message_id: providerMessageId/);
  assert.match(helper, /network_ambiguous/);
  assert.match(helper, /concurrent_idempotent_requests/);
  assert.match(helper, /provider_accepted_receipt_persist_ambiguous/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_followup_autopilot_run_once/);
  assert.match(migration, /rule_id LIKE 'autopilot_run:%'/);
});

test("free run ledger is service-managed and supports free telemetry", async () => {
  const migration = await read("supabase/migrations/20260915033000_autopilot_free_runs.sql");
  const funnel = await read("api/_lib/autopilotFunnel.js");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.autopilot_runs/);
  assert.match(migration, /recipient_snapshot JSONB NOT NULL/);
  assert.match(migration, /REVOKE ALL ON public\.autopilot_runs FROM anon, authenticated/);
  assert.match(migration, /CREATE POLICY autopilot_runs_no_client/);
  assert.match(migration, /'free_run_started'/);
  assert.match(migration, /'free'/);
  assert.match(funnel, /"free_run_started"/);
  assert.match(funnel, /"free"/);
});

test("authenticated Autopilot UI is free-only", async () => {
  const page = await read("src/pages/Autopilot.jsx");
  assert.match(page, /runAutopilotFree/);
  assert.match(page, /Run free recovery sprint/);
  assert.match(page, /There is no checkout or paid plan required/);
  assert.match(page, /setSelected\(\[\]\)/);
  assert.doesNotMatch(page, /createAutopilotOrder|runAutopilotOrder|runAutopilotMembership/);
  assert.doesNotMatch(page, /getPlanCheckoutUrl|resolvePlan|VITE_AUTOPILOT_ONETIME_CHECKOUT/);
  assert.doesNotMatch(page, /\$9(?:\.00|\.99)?|Checkout complete|Get Pro/);
});

test("public Autopilot preview is explicitly free and has no paid execution CTA", async () => {
  const page = await read("src/pages/AutopilotPublic.jsx");
  assert.match(page, /Free to use/);
  assert.match(page, /No checkout or paid plan is required/);
  assert.match(page, /Create account/);
  assert.match(page, /Sign in/);
  assert.doesNotMatch(page, /createAutopilotOrder|runAutopilotOrder|runAutopilotMembership|VITE_AUTOPILOT_ONETIME_CHECKOUT|\$9(?:\.00|\.99)?|Get Pro|one-time sprint/i);
});

test("TitanOS Stripe route exits before loading Stripe while Attention stays isolated", async () => {
  const webhook = await read("api/functions/stripeWebhook.js");
  const ignoreIndex = webhook.indexOf("if (!isAttentionDeployment())");
  const secretIndex = webhook.indexOf("const stripeKey = process.env.STRIPE_SECRET_KEY");
  const handlerImportIndex = webhook.indexOf("await import(\"../_lib/stripeWebhookProductHandler.js\")");
  assert.ok(ignoreIndex >= 0 && secretIndex > ignoreIndex, "TitanOS must exit before reading Stripe credentials");
  assert.ok(handlerImportIndex > secretIndex, "Attention payment handler must be loaded only after TitanOS has exited");
  assert.match(webhook, /autopilot_payments_retired/);
  assert.match(webhook, /metadata\.kind !== ATTENTION_KIND/);
  assert.doesNotMatch(webhook, /^import .*stripeWebhookProductHandler/m);
  assert.doesNotMatch(webhook, /AUTOPILOT_TASK|task_type ===/);
});

test("Autopilot Recovery Receipts stay protected from generic Follow-ups", async () => {
  const sender = await read("api/functions/sendFollowUp.js");
  const client = await read("src/lib/followUpApi.js");
  const rls = await read("supabase/migrations/20260914194500_autopilot_queue_rls.sql");
  const page = await read("src/pages/FollowUps.jsx");
  assert.match(sender, /AUTOPILOT_QUEUE_PROTECTED/);
  assert.match(sender, /startsWith\("autopilot_run:"\)/);
  assert.match(client, /isAutopilotFollowUp/);
  assert.match(rls, /NOT LIKE 'autopilot_run:%'/);
  assert.match(page, /Autopilot Recovery Receipts/);
});

test("Autopilot funnel telemetry remains privacy-minimized and non-blocking", async () => {
  const migration = await read("supabase/migrations/20260914193000_autopilot_funnel_events.sql");
  const helper = await read("api/_lib/autopilotFunnel.js");
  assert.match(migration, /REVOKE ALL ON public\.autopilot_funnel_events FROM anon, authenticated/);
  assert.doesNotMatch(migration, /customer_email|invoice_id|message_body|raw_referrer|ip_address/);
  assert.match(helper, /return !error/);
});
