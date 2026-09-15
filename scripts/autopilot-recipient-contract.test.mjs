import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("invoice recipient snapshot is derived only from an owner-matched customer", async () => {
  const migration = await read("supabase/migrations/20260914210000_autopilot_recipient_snapshot.sql");
  assert.match(migration, /ADD COLUMN IF NOT EXISTS customer_email TEXT/);
  assert.match(migration, /c\.created_by_id = i\.created_by_id/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.snapshot_invoice_customer_email/);
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /c\.created_by_id = NEW\.created_by_id/);
  assert.match(migration, /NEW\.customer_email := NULL/);
  assert.match(migration, /BEFORE INSERT OR UPDATE OF customer_id, created_by_id, customer_email/);
});

test("free run persists the exact approved invoice-email snapshot", async () => {
  const runner = await read("api/functions/runAutopilotFree.js");
  const migration = await read("supabase/migrations/20260915033000_autopilot_free_runs.sql");
  assert.match(runner, /function buildRecipientSnapshot\(invoiceIds, invoices\)/);
  assert.match(runner, /function approvedRecipientMap\(invoiceIds, snapshot\)/);
  assert.match(runner, /recipient_snapshot: requestedSnapshot/);
  assert.match(runner, /existing\.recipient_snapshot/);
  assert.match(runner, /AUTOPILOT_RECIPIENT_SNAPSHOT_REQUIRED/);
  assert.match(migration, /recipient_snapshot JSONB NOT NULL DEFAULT '\[\]'::jsonb/);
});

test("free recovery stops recipient drift and never infers a replacement address", async () => {
  const runner = await read("api/functions/runAutopilotFree.js");
  assert.match(runner, /recipientKey\(prior\.customer_email\) !== approvedEmail/);
  assert.match(runner, /recipientKey\(fresh\) !== approvedEmail/);
  assert.match(runner, /approved_recipient_mismatch/);
  assert.match(runner, /approved_recipient_changed/);
  assert.match(runner, /customer_email: approvedEmail/);
  assert.doesNotMatch(runner, /approvedEmail\s*=\s*recipientKey\(fresh/);
});

test("free run ledger and telemetry are explicit client deny-by-default", async () => {
  const freeRuns = await read("supabase/migrations/20260915033000_autopilot_free_runs.sql");
  const funnel = await read("supabase/migrations/20260914193000_autopilot_funnel_events.sql");
  assert.match(freeRuns, /REVOKE ALL ON public\.autopilot_runs FROM anon, authenticated/);
  assert.match(freeRuns, /CREATE POLICY autopilot_runs_no_client/);
  assert.match(freeRuns, /FOR ALL[\s\S]*TO anon, authenticated[\s\S]*USING \(false\)[\s\S]*WITH CHECK \(false\)/);
  assert.match(funnel, /CREATE POLICY autopilot_funnel_events_no_client/);
});

test("atomic invoice delivery guard is service-only and fail-closed", async () => {
  const migration = await read("supabase/migrations/20260915043000_autopilot_invoice_delivery_guard.sql");
  const runner = await read("api/functions/runAutopilotFree.js");
  assert.match(migration, /autopilot_invoice_delivery_guards_no_client/);
  assert.match(migration, /REVOKE ALL ON public\.autopilot_invoice_delivery_guards FROM anon, authenticated/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.claim_autopilot_invoice_delivery/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.release_autopilot_invoice_delivery/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.claim_autopilot_invoice_delivery[\s\S]*TO service_role/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.release_autopilot_invoice_delivery[\s\S]*TO service_role/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /created_by_id = p_user_id/);
  assert.match(runner, /claimInvoiceDelivery/);
  assert.match(runner, /releaseInvoiceDelivery/);
});

test("Recovery Receipts are owner-readable but protected from client mutation", async () => {
  const rls = await read("supabase/migrations/20260914194500_autopilot_queue_rls.sql");
  assert.match(rls, /FOR SELECT/);
  assert.match(rls, /FOR INSERT/);
  assert.match(rls, /FOR UPDATE/);
  assert.match(rls, /FOR DELETE/);
  assert.match(rls, /NOT LIKE 'autopilot_run:%'/);
});

test("recovered TitanOS keeps service-role-only durable abuse protection", async () => {
  const migration = await read("supabase/migrations/20260914211500_restore_durable_rate_limit_backend.sql");
  const limiter = await read("api/_lib/rateLimit.js");
  const runner = await read("api/functions/runAutopilotFree.js");
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.consume_rate_limit/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.consume_rate_limit[\s\S]*TO service_role/);
  assert.match(limiter, /consume_rate_limit/);
  assert.match(runner, /requireDurable: true/);
  assert.match(runner, /durableUnavailableStatus: 424/);
});

test("TitanOS remains the default surface and public Autopilot stays API-light", async () => {
  const main = await read("src/main.jsx");
  const app = await read("src/App.jsx");
  const publicPreview = await read("src/pages/AutopilotPublic.jsx");
  const publicTelemetry = await read("src/lib/autopilotPublicTelemetry.js");
  const tabs = await read("src/components/layout/TabStack.jsx");
  const attentionSurface = await read("src/AttentionSurface.jsx");
  const android = await read(".github/workflows/android-release.yml");

  assert.match(main, /if \(isNativeApp\(\)\) return "titanos"/);
  assert.match(main, /return "titanos"/);
  assert.match(main, /bootTitanOS/);
  assert.match(main, /bootAttention/);
  assert.doesNotMatch(main, /LEGACY_PURGE_MARKER|purgeLegacyClientStateOnce|LEGACY_KEY_PATTERN/);
  assert.match(app, /AutopilotPublic/);
  assert.match(app, /<Route path="\/autopilot" element=\{<AutopilotPublic \/>\} \/>/);
  assert.match(tabs, /"\/autopilot": Autopilot/);
  assert.match(publicPreview, /Example preview · sample data/);
  assert.match(publicPreview, /trackPublicAutopilotPreview/);
  assert.doesNotMatch(publicPreview, /useAuth|api\.entities|api\.functions|Invoice\.list|runAutopilot|PageHeader|components\/ui\/button/);
  assert.doesNotMatch(publicTelemetry, /apiClient|createClient|supabase|useAuth/);
  assert.match(attentionSurface, /import AttentionApp from "\.\/AttentionApp\.jsx"/);
  assert.match(android, /VITE_APP_SURFACE: "titanos"/);
  assert.match(android, /wbymywwrpbljfbsemung\.supabase\.co/);
});

test("TitanOS Autopilot is detached from Stripe while Attention remains Stripe-capable", async () => {
  const router = await read("api/functions/stripeWebhook.js");
  const checkout = await read("api/functions/createAutopilotOrder.js");
  const quality = await read(".github/workflows/attention-build.yml");
  assert.match(router, /if \(!isAttentionDeployment\(\)\)/);
  assert.match(router, /autopilot_payments_retired/);
  assert.match(router, /metadata\.kind !== ATTENTION_KIND/);
  assert.doesNotMatch(router, /AUTOPILOT_TASK|task_type ===/);
  assert.match(checkout, /AUTOPILOT_PAID_CHECKOUT_RETIRED/);
  assert.doesNotMatch(checkout, /import Stripe|STRIPE_SECRET_KEY|SPRINT_PRICE_CENTS/);
  assert.doesNotMatch(quality, /TITAN_STRIPE_WEBHOOK_PRODUCT/);
});
