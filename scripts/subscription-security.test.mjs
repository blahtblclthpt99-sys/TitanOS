import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("subscription Checkout authority is server-only and serialized per user", async () => {
  const migration = await read("supabase/migrations/20260910093000_subscription_checkout_integrity.sql");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.stripe_subscription_checkout_claims/);
  assert.match(migration, /ALTER TABLE public\.stripe_subscription_checkout_claims ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.stripe_subscription_checkout_claims FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT ALL ON TABLE public\.stripe_subscription_checkout_claims TO service_role/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /idx_subscription_checkout_one_unresolved_per_user/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.claim_subscription_checkout[\s\S]*FROM authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.claim_subscription_checkout[\s\S]*TO service_role/);
});

test("subscription claim blocks existing non-terminal provider subscriptions and ambiguous completed Checkout", async () => {
  const migration = await read("supabase/migrations/20260910093000_subscription_checkout_integrity.sql");
  assert.match(migration, /NOT IN \('canceled','incomplete_expired'\)/);
  assert.match(migration, /subscription_existing_nonterminal/);
  assert.match(migration, /c\.state IN \('completed','requires_review'\)/);
  assert.match(migration, /subscription_checkout_reconciliation_required/);
  assert.match(migration, /v_claim\.stripe_subscription_id IS NULL/);
  assert.match(migration, /SET state = 'closed'/);
});

test("subscription Checkout reuses one claim-scoped Stripe Session instead of a time bucket", async () => {
  const source = await read("api/functions/createSubscriptionCheckout.js");
  assert.match(source, /admin\.rpc\("claim_subscription_checkout"/);
  assert.match(source, /idempotencyKey: `subscription_checkout_\$\{claim\.claim_id\}`/);
  assert.doesNotMatch(source, /Math\.floor\(Date\.now\(\) \/ 300000\)/);
  assert.match(source, /stripe\.checkout\.sessions\.retrieve\(claim\.stripe_session_id\)/);
  assert.match(source, /existingSession\.status === "open"/);
  assert.match(source, /existingSession\.status === "complete"/);
  assert.match(source, /existingSession\.status === "expired"/);
  assert.match(source, /SAFE_IDEMPOTENCY_RETRY_MS = 23 \* 60 \* 60 \* 1000/);
  assert.match(source, /SUBSCRIPTION_RECONCILIATION_REQUIRED/);
});

test("existing non-terminal subscription routes to billing management instead of new Checkout", async () => {
  const source = await read("api/functions/createSubscriptionCheckout.js");
  assert.match(source, /TERMINAL_SUBSCRIPTION_STATUSES = new Set\(\["canceled", "incomplete_expired"\]\)/);
  assert.match(source, /existingSubscriptionResponse/);
  assert.match(source, /stripe\.billingPortal\.sessions\.create/);
  assert.match(source, /existingSubscription: true/);
  assert.match(source, /MULTIPLE_SUBSCRIPTIONS_REQUIRES_REVIEW/);
});

test("subscription Checkout reuses historical Stripe customer identity", async () => {
  const migration = await read("supabase/migrations/20260910093000_subscription_checkout_integrity.sql");
  const source = await read("api/functions/createSubscriptionCheckout.js");
  assert.match(migration, /SELECT s\.stripe_customer_id[\s\S]*ORDER BY s\.updated_at DESC/);
  assert.match(source, /if \(claim\.stripe_customer_id\) checkoutParams\.customer = claim\.stripe_customer_id/);
  assert.match(source, /else checkoutParams\.customer_email = user\.email/);
});

test("Checkout metadata links user, plan, claim, and resulting subscription", async () => {
  const source = await read("api/functions/createSubscriptionCheckout.js");
  const sync = await read("api/_lib/stripeSubscriptions.js");
  assert.match(source, /checkout_claim_id: claim\.claim_id/);
  assert.match(source, /source: "subscription_checkout"/);
  assert.match(source, /subscription_data:[\s\S]*checkout_claim_id: claim\.claim_id/);
  assert.match(source, /stripe_subscription_id: stripeSubscriptionId/);
  assert.match(sync, /subscription\?\.metadata\?\.checkout_claim_id/);
  assert.match(sync, /stripe_subscription_id: stripeSubscriptionId/);
  assert.match(sync, /state: claimState/);
  assert.match(sync, /TERMINAL_STATUSES\.has/);
});

test("billing portal refuses ambiguous active Stripe customer identities", async () => {
  const source = await read("api/functions/stripeCustomerPortal.js");
  assert.match(source, /nonterminalCustomerIds\.length > 1/);
  assert.match(source, /MULTIPLE_SUBSCRIPTIONS_REQUIRES_REVIEW/);
  assert.match(source, /stripe\.billingPortal\.sessions\.create/);
  assert.match(source, /maxNetworkRetries: 1/);
});

test("subscription status surfaces duplicate billing risk without returning Stripe customer ids", async () => {
  const source = await read("api/functions/subscriptionStatus.js");
  assert.match(source, /nonterminalSubscriptionCount: nonterminalRows\.length/);
  assert.match(source, /distinctBillingIdentityCount: distinctBillingIdentities/);
  assert.match(source, /requiresReview: billingRequiresReview/);
  assert.match(source, /subscriptionStatus:billing_integrity_review/);
  assert.doesNotMatch(source, /billingIntegrity:[\s\S]*stripe_customer_id/);
});
