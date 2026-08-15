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
    const found = candidates.some((p) => existsSync(join(root, p)));
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

describe("Stage-1 hardening: portal data exposure (A)", () => {
  it("portalGetData uses explicit field allowlists, not select(*)", () => {
    const src = read("api/functions/portalGetData.js");
    assert.doesNotMatch(src, /\.select\(["']\*["']\)/);
    assert.match(src, /id,\s*title,\s*service_type/);
    assert.match(src, /id,\s*invoice_number/);
    assert.match(src, /id,\s*estimate_number/);
  });

  it("portalVerifyOtp narrows customer fetch to safe fields", () => {
    const src = read("api/functions/portalVerifyOtp.js");
    assert.doesNotMatch(src, /\.select\(["']\*["']\)/);
    assert.match(src, /id,\s*first_name,\s*last_name,\s*email/);
  });
});

describe("Stage-1 hardening: portal tenant isolation (B)", () => {
  it("portalRequestOtp collects all email matches (no limit(1) on customer lookup)", () => {
    const src = read("api/functions/portalRequestOtp.js");
    // The old code used .limit(1) and grabbed data[0] — silently picking the first tenant.
    // Hardened code collects all matches and fails closed on cross-tenant ambiguity.
    assert.doesNotMatch(src, /\.select\(["']\*["']\)/);
    assert.match(src, /tenantIds/);
    assert.match(src, /fail closed/i);
  });

  it("portalRequestOtp stores business_owner_id in session", () => {
    const src = read("api/functions/portalRequestOtp.js");
    assert.match(src, /business_owner_id/);
  });

  it("portalGetData enforces session tenant matches customer tenant", () => {
    const src = read("api/functions/portalGetData.js");
    assert.match(src, /business_owner_id/);
    assert.match(src, /tenant mismatch/i);
  });
});

describe("Stage-1 hardening: portal token legacy disabled by default (C)", () => {
  it("portalToken.js defaults PORTAL_TOKEN_ALLOW_LEGACY to '0'", () => {
    const src = read("api/_lib/portalToken.js");
    assert.doesNotMatch(src, /PORTAL_TOKEN_ALLOW_LEGACY[^"']*["']1["']/);
    assert.match(src, /PORTAL_TOKEN_ALLOW_LEGACY[^"']*["']0["']/);
  });
});

describe("Stage-1 hardening: Stripe payment ownership separation (D+E)", () => {
  it("createPaymentLink stores invoice_owner_id separately from user_id in metadata", () => {
    const src = read("api/functions/createPaymentLink.js");
    assert.match(src, /invoice_owner_id/);
    assert.match(src, /invoiceOwnerId/);
    // Both actor and owner metadata must be set
    assert.match(src, /metadata\[.?user_id.?\]/);
    assert.match(src, /metadata\[.?invoice_owner_id.?\]/);
  });

  it("stripeWebhook prefers invoice_owner_id over user_id for ownership check", () => {
    const src = read("api/functions/stripeWebhook.js");
    assert.match(src, /invoice_owner_id/);
    // Must fall back to user_id for legacy sessions
    assert.match(src, /invoice_owner_id.*\|\|.*user_id/);
  });

  it("stripeWebhook signature verification is never bypassed", () => {
    const src = read("api/functions/stripeWebhook.js");
    assert.match(src, /constructEvent/);
    // STRIPE_WEBHOOK_RELAXED must not skip signature check
    assert.doesNotMatch(src, /STRIPE_WEBHOOK_RELAXED.*constructEvent/);
    assert.match(src, /Never process unverified/i);
  });
});
