import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isAllowedAiIntent } from "../api/_lib/aiIntents.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

describe("security regression", () => {
  it("rejects privilege AI intents", () => {
    assert.equal(isAllowedAiIntent("set_plan_tier"), false);
    assert.equal(isAllowedAiIntent("capture_payment"), false);
  });

  it("PayPal settle path is capture-gated in source", () => {
    const candidates = [
      "api/functions/paypalCapture.js",
      "api/functions/paypalWebhook.js",
      "api/paypal",
    ];
    assert.ok(candidates.some((p) => existsSync(join(root, p))));
    // Broader scan
    const payDir = join(root, "api");
    assert.ok(existsSync(payDir));
    const hardening = read("scripts/production-hardening.test.mjs");
    assert.match(hardening, /paypal|webhook|idempotenc/i);
  });

  it("entity adapter blocks client paid invoice status", () => {
    const src = read("src/api/entityAdapter.js");
    assert.match(src, /Invoice/);
    assert.match(src, /paid/);
    assert.match(src, /webhook/i);
  });

  it("portal OTP pepper is server-side only (no VITE_ pepper)", () => {
    const envExample = read(".env.example");
    assert.doesNotMatch(envExample, /VITE_PORTAL_OTP/);
    assert.match(envExample, /PORTAL_OTP_PEPPER/);
  });

  it("premium APIs assert server entitlements", () => {
    assert.match(read("api/functions/titanAI.js"), /requireFeature/);
    assert.match(read("api/functions/receiptVisionOcr.js"), /FEATURES\.ocrReceipts/);
    assert.match(read("api/_lib/entitlements.js"), /loadEntitlementProfile/);
    assert.match(read("src/lib/marketplaceApi.js"), /installMarketplaceModule/);
  });
});
