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

function componentBlock(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  assert.notEqual(start, -1, `${startToken} must exist`);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.notEqual(end, -1, `${endToken} must exist after ${startToken}`);
  return source.slice(start, end);
}

describe("Google Play billing policy boundary", () => {
  const pricing = read("src/pages/Pricing.jsx");
  const stripe = read("src/lib/stripeSubscriptions.js");

  it("uses Google Play subscriptions for configured paid plans in Android Play builds", () => {
    const planCard = componentBlock(pricing, "function PlanCard(", "\nexport default function Pricing");
    assert.match(pricing, /const androidPlay = isAndroidPlayBuild\(\)/);
    assert.match(planCard, /const playEnabled = androidPlay && paid && Boolean\(PLAY_SUBSCRIPTIONS\[definition\.planId\]\)/);
    assert.match(planCard, /if \(playEnabled\) return onPlayPurchase\(definition\.planId\)/);
    assert.match(pricing, /startPlaySubscription\(planId, user\.id\)/);
    assert.match(pricing, /Android subscription via Google Play/);
  });

  it("blocks Stripe subscription checkout inside the Android Play build", () => {
    const block = functionBlock(stripe, "startStripeSubscription");
    assert.match(block, /if \(isAndroidPlayBuild\(\)\)/);
    assert.match(block, /handled securely by Google Play/);
    assert.ok(block.indexOf("isAndroidPlayBuild()") < block.indexOf("createSubscriptionCheckout"));
  });

  it("keeps the Android guard in front of every Pricing Stripe fallback", () => {
    const planCard = componentBlock(pricing, "function PlanCard(", "\nexport default function Pricing");
    assert.match(planCard, /return onStripePurchase\(definition\.planId\)/);
    const stripeBlock = functionBlock(stripe, "startStripeSubscription");
    assert.ok(stripeBlock.indexOf("isAndroidPlayBuild()") < stripeBlock.indexOf("createSubscriptionCheckout"));
  });

  it("routes billing management to Google Play rather than Stripe on Android", () => {
    const block = functionBlock(stripe, "openStripeCustomerPortal");
    assert.match(block, /if \(isAndroidPlayBuild\(\)\)/);
    assert.match(block, /https:\/\/play\.google\.com\/store\/account\/subscriptions/);
    assert.ok(block.indexOf("play.google.com/store/account/subscriptions") < block.indexOf("stripeCustomerPortal"));
  });
});
