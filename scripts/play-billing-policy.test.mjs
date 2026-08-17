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
});
