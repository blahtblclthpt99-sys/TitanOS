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
  assert.match(migration, /BEFORE INSERT OR UPDATE OF customer_id, created_by_id, customer_email/);
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

test("Autopilot service-only tables are explicit client deny-by-default", async () => {
  const claims = await read("supabase/migrations/042_autopilot_membership_claims.sql");
  const funnel = await read("supabase/migrations/20260914193000_autopilot_funnel_events.sql");

  assert.match(claims, /CREATE POLICY autopilot_membership_claims_no_client/);
  assert.match(claims, /FOR ALL[\s\S]*TO anon, authenticated[\s\S]*USING \(false\)[\s\S]*WITH CHECK \(false\)/);
  assert.match(funnel, /CREATE POLICY autopilot_funnel_events_no_client/);
  assert.match(funnel, /FOR ALL[\s\S]*TO anon, authenticated[\s\S]*USING \(false\)[\s\S]*WITH CHECK \(false\)/);
});

test("recovered TitanOS has a service-role-only durable outbound rate-limit fallback", async () => {
  const migration = await read("supabase/migrations/20260914211500_restore_durable_rate_limit_backend.sql");
  const limiter = await read("api/_lib/rateLimit.js");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.titan_rate_limit_buckets/);
  assert.match(migration, /CREATE POLICY titan_rate_limit_buckets_no_client/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.consume_rate_limit/);
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.consume_rate_limit/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.consume_rate_limit[\s\S]*TO service_role/);
  assert.match(limiter, /consume_rate_limit/);
  assert.match(limiter, /requireDurable/);
});

test("TitanOS stays the default surface and Product Hunt Autopilot remains reachable", async () => {
  const main = await read("src/main.jsx");
  const app = await read("src/App.jsx");
  const tabs = await read("src/components/layout/TabStack.jsx");
  const attentionSurface = await read("src/AttentionSurface.jsx");
  const android = await read(".github/workflows/android-release.yml");

  assert.match(main, /VITE_APP_SURFACE/);
  assert.match(main, /if \(isNativeApp\(\)\) return "titanos"/);
  assert.match(main, /return "titanos"/);
  assert.match(main, /import\("\.\/AttentionSurface\.jsx"\)/);
  assert.match(main, /import\("\.\/App\.jsx"\)/);
  assert.match(main, /bootTitanOS/);
  assert.match(main, /bootAttention/);
  assert.doesNotMatch(main, /LEGACY_PURGE_MARKER|purgeLegacyClientStateOnce|LEGACY_KEY_PATTERN/);

  assert.match(app, /const Autopilot = lazy\(\(\) => import\("@\/pages\/Autopilot"\)\)/);
  assert.match(app, /"\/autopilot"/);
  assert.match(app, /PUBLIC_PREVIEW_APP_ROUTES/);
  assert.match(app, /previewAppRoute/);
  assert.match(tabs, /"\/autopilot": Autopilot/);

  assert.match(attentionSurface, /import AttentionApp from "\.\/AttentionApp\.jsx"/);
  assert.match(attentionSurface, /import "\.\/attention\.css"/);
  assert.doesNotMatch(app, /attention\.css/);

  assert.match(android, /VITE_APP_SURFACE: "titanos"/);
  assert.match(android, /wbymywwrpbljfbsemung\.supabase\.co/);
  assert.doesNotMatch(android, /VITE_SUPABASE_URL: "https:\/\/xcfjpxcmokdfwkarwomy\.supabase\.co"/);
});

test("Stripe webhook verifies first and isolates Autopilot from Titan Attention", async () => {
  const router = await read("api/functions/stripeWebhook.js");
  const productHandler = await read("api/functions/stripeWebhookProductHandler.js");

  assert.match(router, /constructEvent\(rawBody, signature, webhookSecret\)/);
  assert.match(router, /function classifyStripeProduct\(event\)/);
  assert.match(router, /metadata\.task_type === AUTOPILOT_TASK/);
  assert.match(router, /metadata\.kind === ATTENTION_KIND/);
  assert.match(router, /function configuredWebhookProduct\(\)/);
  assert.match(router, /TITAN_STRIPE_WEBHOOK_PRODUCT/);
  assert.match(router, /eventProduct === "unclassified"/);
  assert.match(router, /eventProduct !== deploymentProduct/);
  assert.match(router, /scope_mismatch: true/);
  assert.match(router, /req\.rawBody = rawBody/);
  assert.match(router, /return legacyProductHandler\(req, res\)/);
  assert.doesNotMatch(router, /getSupabaseAdmin/);

  assert.match(productHandler, /claimAutopilotEvent/);
  assert.match(productHandler, /attention_payment_events/);
  assert.match(productHandler, /activate_attention_campaign_funding_service/);
});

test("recipient contract never infers a replacement address during recovery", async () => {
  const order = await read("api/functions/runAutopilotOrder.js");
  const membership = await read("api/functions/runAutopilotMembership.js");

  assert.match(order, /Create a new sprint so the recipients can be approved again/);
  assert.match(membership, /Titan will not infer replacement recipients/);
  assert.doesNotMatch(order, /approvedEmail\s*=\s*normalizeEmail\(fresh/);
  assert.doesNotMatch(membership, /approvedEmail\s*=\s*recipientKey\(fresh/);
});