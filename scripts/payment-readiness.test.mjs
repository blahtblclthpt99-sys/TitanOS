import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyLaunchStatus,
  applyLaunchStatusFromServer,
  getLaunchStatus,
  hydrateLaunchStatus,
  invalidateLaunchPaymentReadiness,
  isLaunchStatusVerified,
  isMembershipCheckoutLive,
  normalizeLaunchStatus,
} from "../src/lib/launchStatus.js";
import { STRIPE_CHECKOUT, getPlanCheckoutUrl } from "../src/lib/plan.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const store = new Map();

globalThis.localStorage = {
  getItem(key) {
    return store.has(key) ? store.get(key) : null;
  },
  setItem(key, value) {
    store.set(key, String(value));
  },
  removeItem(key) {
    store.delete(key);
  },
  clear() {
    store.clear();
  },
};

function verifiedLaunch(overrides = {}) {
  return {
    foundingCap: 100,
    foundingClaimed: 7,
    betaActive: true,
    membershipPaymentsLive: true,
    verified: true,
    source: "platform_launch",
    ...overrides,
  };
}

beforeEach(() => {
  store.clear();
  applyLaunchStatus({
    foundingCap: 100,
    foundingClaimed: 0,
    betaActive: true,
    membershipPaymentsLive: false,
  });
});

describe("client payment readiness", () => {
  it("defaults and untrusted state fail closed", () => {
    assert.equal(isMembershipCheckoutLive(), false);
    assert.equal(isLaunchStatusVerified(), false);

    applyLaunchStatus(verifiedLaunch());
    assert.equal(isMembershipCheckoutLive(), false);
    assert.equal(isLaunchStatusVerified(), false);
  });

  it("accepts checkout readiness only from a verified platform_launch server payload", () => {
    const status = applyLaunchStatusFromServer(verifiedLaunch());
    assert.equal(status.verified, true);
    assert.equal(status.source, "platform_launch");
    assert.equal(status.membershipPaymentsLive, true);
    assert.equal(isMembershipCheckoutLive(), true);
  });

  it("rejects malformed or merely truthy values", () => {
    const malformed = normalizeLaunchStatus(
      {
        foundingCap: 100,
        foundingClaimed: 7,
        betaActive: "false",
        membershipPaymentsLive: "true",
        verified: true,
        source: "platform_launch",
      },
      { trustedServerResponse: true }
    );
    assert.equal(malformed.verified, false);
    assert.equal(malformed.membershipPaymentsLive, false);

    const fractional = normalizeLaunchStatus(
      verifiedLaunch({ foundingClaimed: 7.5 }),
      { trustedServerResponse: true }
    );
    assert.equal(fractional.verified, false);
    assert.equal(fractional.membershipPaymentsLive, false);
  });

  it("never persists payment readiness or verification into localStorage", () => {
    applyLaunchStatusFromServer(verifiedLaunch());
    assert.equal(isMembershipCheckoutLive(), true);

    const cached = JSON.parse(store.get("titanos_launch_status_v1"));
    assert.equal(Object.hasOwn(cached, "membershipPaymentsLive"), false);
    assert.equal(Object.hasOwn(cached, "verified"), false);
    assert.equal(Object.hasOwn(cached, "source"), false);

    hydrateLaunchStatus();
    assert.equal(isMembershipCheckoutLive(), false);
    assert.equal(isLaunchStatusVerified(), false);
    assert.equal(getLaunchStatus().source, "cache_display_only");
  });

  it("ignores a malicious legacy cache that claims checkout is live", () => {
    store.set(
      "titanos_launch_status_v1",
      JSON.stringify({
        foundingCap: 100,
        foundingClaimed: 9,
        betaActive: true,
        membershipPaymentsLive: true,
        verified: true,
        source: "platform_launch",
        fetchedAt: Date.now(),
      })
    );
    hydrateLaunchStatus();
    assert.equal(isMembershipCheckoutLive(), false);
    assert.equal(isLaunchStatusVerified(), false);
  });

  it("revokes a previously verified session immediately", () => {
    applyLaunchStatusFromServer(verifiedLaunch());
    assert.equal(isMembershipCheckoutLive(), true);
    invalidateLaunchPaymentReadiness();
    assert.equal(isMembershipCheckoutLive(), false);
    assert.equal(isLaunchStatusVerified(), false);
  });

  it("ships no static direct Stripe checkout URLs in the browser", () => {
    assert.deepEqual(STRIPE_CHECKOUT, {
      starter: null,
      worker_premium: null,
      business: null,
      modules: null,
    });
    assert.equal(getPlanCheckoutUrl("starter"), null);
    assert.equal(getPlanCheckoutUrl("worker_premium"), null);
    assert.equal(getPlanCheckoutUrl("business"), null);
  });
});

describe("payment readiness wiring", () => {
  it("binds fresh feature flags to launch readiness and revokes on failure", () => {
    const source = readFileSync(join(root, "src/lib/featureFlags.js"), "utf8");
    assert.match(source, /applyLaunchStatusFromServer\(data\.launch\)/);
    assert.match(source, /invalidateLaunchPaymentReadiness\(\)/);
    assert.match(source, /cache:\s*["']no-store["']/);
  });

  it("blocks the client Stripe helper before invoking checkout", () => {
    const source = readFileSync(join(root, "src/lib/stripeSubscriptions.js"), "utf8");
    const gate = source.indexOf("if (!isMembershipCheckoutLive())");
    const invoke = source.indexOf('invoke("createSubscriptionCheckout"');
    assert.ok(gate >= 0, "client checkout readiness gate missing");
    assert.ok(invoke > gate, "client invokes checkout before readiness is proven");
    assert.match(source, /checkout\.stripe\.com/);
  });

  it("requires the explicit server environment gate before Stripe checkout configuration", () => {
    const lib = readFileSync(join(root, "api/_lib/stripeSubscriptions.js"), "utf8");
    assert.match(lib, /MEMBERSHIP_PAYMENTS_LIVE\s*===\s*["']true["']/);

    const handler = readFileSync(join(root, "api/functions/createSubscriptionCheckout.js"), "utf8");
    const gate = handler.indexOf("if (!membershipPaymentsEnabled())");
    const configured = handler.indexOf("if (!stripeSubscriptionsConfigured())");
    const create = handler.indexOf("stripe.checkout.sessions.create");
    assert.ok(gate >= 0, "server membership kill switch missing");
    assert.ok(configured > gate, "credential check runs before authoritative payment gate");
    assert.ok(create > configured, "Stripe session creation runs before configuration gate");
  });

  it("keeps the Cloudflare payment route staged rather than widening routing", () => {
    const router = readFileSync(join(root, "cloudflare/api-router.js"), "utf8");
    assert.doesNotMatch(router, /createSubscriptionCheckout/);

    const worker = readFileSync(join(root, "cloudflare/worker.js"), "utf8");
    assert.match(worker, /production_cutover_ready:\s*false/);
    assert.match(worker, /unmigrated_api_policy:\s*["']fail-closed["']/);
  });
});
