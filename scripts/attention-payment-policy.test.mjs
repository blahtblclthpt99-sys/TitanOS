import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const apiPath = new URL("../cloudflare/attention-api.js", import.meta.url);
const workerPath = new URL("../cloudflare/worker.js", import.meta.url);
const wranglerPath = new URL("../wrangler.jsonc", import.meta.url);
const appPath = new URL("../src/App.jsx", import.meta.url);

async function source(path) {
  return readFile(path, "utf8");
}

test("Cloudflare-native campaign checkout fails closed around existing Stripe sessions", async () => {
  const code = await source(apiPath);
  assert.match(code, /checkout\.sessions\.retrieve\(campaign\.stripe_checkout_session_id\)/);
  assert.match(code, /isMissingStripeResource\(error\)/);
  assert.match(code, /throw error;/);
  assert.match(code, /idempotencyKey:\s*`attention-fund-/);
  assert.match(code, /\.eq\("advertiser_id", user\.id\)/);
  assert.match(code, /\.eq\("funded_cents", Number\(campaign\.funded_cents \|\| 0\)\)/);
  assert.match(code, /APP_ORIGIN must be a clean HTTPS origin/);
  assert.match(code, /Stripe\.createFetchHttpClient\(\)/);
});

test("Cloudflare-native funding webhook verifies raw Stripe body and refuses silent reconciliation failures", async () => {
  const code = await source(apiPath);
  assert.match(code, /await request\.text\(\)/);
  assert.match(code, /constructEventAsync/);
  assert.match(code, /Stripe\.createSubtleCryptoProvider\(\)/);
  assert.match(code, /attention_payment_events/);
  assert.match(code, /activate_attention_campaign_funding_service/);
  assert.match(code, /expected !== paid/);
  assert.match(code, /Campaign advertiser mismatch/);
  assert.match(code, /Checkout session mismatch/);
  assert.match(code, /requireDatabaseUpdate/);
  assert.match(code, /paymentIntents\.retrieve\(paymentIntentId\)/);
  assert.match(code, /FUNDING_EVENTS\.has\(event\.type\)/);
});

test("Worker owns only the active Attention payment routes and has no Vercel proxy", async () => {
  const worker = await source(workerPath);
  const wrangler = await source(wranglerPath);
  assert.match(worker, /\/api\/attention\/create-checkout/);
  assert.match(worker, /\/api\/functions\/stripeWebhook/);
  assert.match(worker, /legacy_proxy:\s*false/);
  assert.match(worker, /api_runtime:\s*"cloudflare-workers"/);
  assert.doesNotMatch(worker, /LEGACY_API_ORIGIN|proxyLegacyApi|titanos-web\.vercel\.app/);
  assert.doesNotMatch(wrangler, /LEGACY_API_ORIGIN|titanos-web\.vercel\.app/);
});

test("client keeps funding initiation authenticated and same-origin", async () => {
  const code = await source(appPath);
  assert.match(code, /fetch\("\/api\/attention\/create-checkout"/);
  assert.match(code, /Authorization:\s*`Bearer \$\{token\}`/);
  assert.doesNotMatch(code, /STRIPE_SECRET_KEY/);
  assert.doesNotMatch(code, /SUPABASE_SERVICE_ROLE_KEY/);
});
