import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function functionBlock(source, name) {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

describe("Google Play billing policy boundary", () => {
  const pricing = read("src/pages/Pricing.jsx");
  const stripe = read("src/lib/stripeSubscriptions.js");
  const verifier = read("api/functions/googlePlayVerifySubscription.js");
  const receiptsMigration = read("supabase/migrations/041_google_play_subscriptions.sql");

  it("uses Google Play subscriptions for paid plans in Android Play builds", () => {
    assert.match(pricing, /const androidPlay = isAndroidPlayBuild\(\)/);
    assert.match(pricing, /const isPaidPlayPlan = androidPlay/);
    assert.match(pricing, /startPlaySubscription/);
    assert.match(pricing, /const checkoutHref = androidPlay \? null/);
  });

  it("blocks Stripe subscription checkout inside the Android Play build", () => {
    const block = functionBlock(stripe, "startStripeSubscription");
    assert.match(block, /if \(isAndroidPlayBuild\(\)\)/);
    assert.match(block, /handled securely by Google Play/);
    assert.ok(block.indexOf("isAndroidPlayBuild()") < block.indexOf("createSubscriptionCheckout"));
  });

  it("routes billing management to Google Play rather than Stripe on Android", () => {
    const block = functionBlock(stripe, "openStripeCustomerPortal");
    assert.match(block, /if \(isAndroidPlayBuild\(\)\)/);
    assert.match(block, /https:\/\/play\.google\.com\/store\/account\/subscriptions/);
    assert.ok(block.indexOf("play.google.com/store/account/subscriptions") < block.indexOf("stripeCustomerPortal"));
  });

  it("claims each Play purchase token atomically before granting entitlement", () => {
    assert.match(receiptsMigration, /purchase_token text PRIMARY KEY/);
    assert.match(verifier, /\.from\("google_play_subscriptions"\)[\s\S]*?\.insert\(row\)/);
    assert.match(verifier, /insertError\.code !== "23505"/);
    assert.match(verifier, /existing\.user_id !== auth\.user\.id/);
    assert.match(
      verifier,
      /\.update\(refresh\)[\s\S]*?\.eq\("purchase_token", row\.purchase_token\)[\s\S]*?\.eq\("user_id", auth\.user\.id\)/
    );
    assert.doesNotMatch(verifier, /\.upsert\(row,\s*\{\s*onConflict:\s*"purchase_token"/);

    const claimIndex = verifier.indexOf("const receiptClaim = await claimReceipt(auth, row)");
    const entitlementIndex = verifier.indexOf(".update({ plan_tier: planTier, is_pro: true, paying_subscriber: true })");
    assert.ok(claimIndex >= 0 && entitlementIndex > claimIndex, "receipt ownership must be established before paid entitlement");
  });

  it("keeps Play entitlements server-authoritative and account-bound when Google supplies the binding", () => {
    assert.match(verifier, /const PACKAGE_NAME = "com\.titanos\.myapp"/);
    assert.match(verifier, /const accountId = purchase\.externalAccountIdentifiers\?\.obfuscatedExternalAccountId/);
    assert.match(verifier, /accountId && accountId !== sha256\(auth\.user\.id\)/);
    assert.match(verifier, /SUBSCRIPTION_STATE_ACTIVE/);
    assert.match(verifier, /expiresAt\.getTime\(\) > Date\.now\(\)/);
  });
});
