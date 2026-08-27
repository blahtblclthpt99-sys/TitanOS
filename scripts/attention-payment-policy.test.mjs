import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const checkoutPath = new URL("../api/attention/create-checkout.js", import.meta.url);
const webhookPath = new URL("../api/functions/stripeWebhook.js", import.meta.url);
const appPath = new URL("../src/App.jsx", import.meta.url);

async function source(path) {
  return readFile(path, "utf8");
}

test("campaign checkout fails closed around existing Stripe sessions", async () => {
  const code = await source(checkoutPath);
  assert.match(code, /checkout\.sessions\.retrieve\(campaign\.stripe_checkout_session_id\)/);
  assert.match(code, /isMissingStripeResource\(error\)/);
  assert.match(code, /throw error;/);
  assert.match(code, /idempotencyKey:\s*`attention-fund-/);
  assert.match(code, /\.eq\("advertiser_id", user\.id\)/);
  assert.match(code, /\.eq\("funded_cents", Number\(campaign\.funded_cents \|\| 0\)\)/);
  assert.match(code, /APP_ORIGIN must be a clean HTTPS origin/);
});

test("funding webhook verifies Stripe and refuses silent reconciliation failures", async () => {
  const code = await source(webhookPath);
  assert.match(code, /stripe\.webhooks\.constructEvent\(rawBody, signature, webhookSecret\)/);
  assert.match(code, /attention_payment_events/);
  assert.match(code, /activate_attention_campaign_funding_service/);
  assert.match(code, /expected !== paid/);
  assert.match(code, /Campaign advertiser mismatch/);
  assert.match(code, /Checkout session mismatch/);
  assert.match(code, /requireUpdate/);
  assert.match(code, /paymentIntents\.retrieve\(paymentIntentId\)/);
  assert.match(code, /FUNDING_EVENTS\.has\(event\.type\)/);
});

test("client keeps funding initiation authenticated and same-origin", async () => {
  const code = await source(appPath);
  assert.match(code, /fetch\("\/api\/attention\/create-checkout"/);
  assert.match(code, /Authorization:\s*`Bearer \$\{token\}`/);
  assert.doesNotMatch(code, /STRIPE_SECRET_KEY/);
  assert.doesNotMatch(code, /SUPABASE_SERVICE_ROLE_KEY/);
});
