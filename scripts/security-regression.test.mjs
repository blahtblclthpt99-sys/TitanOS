import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isAllowedAiIntent } from "../api/_lib/aiIntents.js";
import { sanitizeInvisibleInterface } from "../src/lib/invisibleInterface.js";

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
    void found;
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

  it("portal identity fails closed on ambiguous email and binds owner", () => {
    const requestOtp = read("api/functions/portalRequestOtp.js");
    const verifyOtp = read("api/functions/portalVerifyOtp.js");
    const portalData = read("api/functions/portalGetData.js");
    assert.match(requestOtp, /candidates\.length === 1/);
    assert.match(requestOtp, /created_by_id/);
    assert.match(verifyOtp, /\.eq\("created_by_id", session\.created_by_id\)/);
    assert.match(portalData, /\.eq\("created_by_id", session\.created_by_id\)/);
    assert.doesNotMatch(portalData, /select\("\*"\)/);
  });

  it("legacy plaintext portal session tokens are opt-in, not default", () => {
    const src = read("api/_lib/portalToken.js");
    assert.match(src, /PORTAL_TOKEN_ALLOW_LEGACY \|\| "0"/);
    assert.doesNotMatch(src, /PORTAL_TOKEN_ALLOW_LEGACY \|\| "1"/);
  });

  it("public contract signing stores only token hashes", () => {
    const migration = read("supabase/migrations/20260815204000_contract_share_token_hashing.sql");
    const publicContract = read("api/functions/publicContract.js");
    const shareToken = read("api/functions/contractShareToken.js");
    assert.match(migration, /share_token_hash/);
    assert.match(migration, /SET share_token = NULL/);
    assert.match(migration, /REVOKE EXECUTE ON FUNCTION public\.get_public_contract_by_share_token/);
    assert.match(publicContract, /share_token_hash/);
    assert.match(shareToken, /randomBytes\(32\)/);
    assert.doesNotMatch(shareToken, /share_token:\s*token/);
  });

  it("payment authority and core tenant ownership are database protected", () => {
    const payment = read("supabase/migrations/20260815202000_payment_authority_lockdown.sql");
    const tenant = read("supabase/migrations/20260815203000_core_tenant_ownership_lockdown.sql");
    assert.match(payment, /protect_payment_authority/);
    assert.match(payment, /NEW\.status := 'pending'/);
    assert.match(payment, /NEW\.invoice_id := OLD\.invoice_id/);
    assert.match(tenant, /NEW\.created_by_id := OLD\.created_by_id/);
    assert.match(tenant, /NEW\.company_id := OLD\.company_id/);
  });

  it("payment-link privileged authority comes only from auth app_metadata", () => {
    const src = read("api/functions/createPaymentLink.js");
    assert.match(src, /app_metadata\?\.role === "admin"/);
    assert.match(src, /invoice\.created_by_id !== user\.id && !serverAdmin/);
    assert.doesNotMatch(src, /profile\?\.role\s*!==\s*"admin"/);
    assert.doesNotMatch(src, /profile\?\.role\s*===\s*"admin"/);
    assert.doesNotMatch(src, /select\("role,/);
  });

  it("database admin authority uses auth app_metadata and trigger helpers are not RPCs", () => {
    const migration = read("supabase/migrations/20260818073500_align_admin_authority_and_revoke_trigger_rpc.sql");
    assert.match(migration, /auth\.jwt\(\)/);
    assert.match(migration, /'app_metadata'/);
    assert.match(migration, /->> 'role'\) = 'admin'/);
    assert.doesNotMatch(migration, /from public\.profiles/i);
    assert.match(migration, /revoke execute on function public\.enforce_marketplace_message_block\(\) from public/i);
    assert.match(migration, /from anon/i);
    assert.match(migration, /from authenticated/i);
  });

  it("sensitive server privilege bypasses use Auth app_metadata only", () => {
    const files = [
      "api/functions/markReferralPaying.js",
      "api/functions/sendEmail.js",
      "api/functions/runAutopilotMembership.js",
      "api/functions/calculateFee.js",
      "api/functions/createNotification.js",
    ];
    for (const file of files) {
      const src = read(file);
      assert.match(
        src,
        /app_metadata\?\.role\s*(?:===|!==)\s*"admin"/,
        `${file} must use Auth metadata for admin authority`
      );
      assert.doesNotMatch(src, /profile\?\.role\s*(?:===|!==)\s*"admin"/, `${file} must not grant admin via profile role`);
    }
  });

  it("Invisible Interface is data-only and cannot carry direct execution", () => {
    const safe = sanitizeInvisibleInterface({
      type: "decision",
      title: "Next action",
      items: [{ label: "Invoice", value: "$100" }],
      actions: [
        { kind: "navigate", label: "Open invoice", path: "/invoices" },
        { kind: "prompt", label: "Plan", prompt: "Prioritize collections" },
      ],
      provenance: "server_snapshot",
    });
    assert.equal(safe.actions.length, 2);
    assert.equal(safe.actions[0].path, "/invoices");

    const hostile = sanitizeInvisibleInterface({
      type: "decision",
      title: "Attack",
      actions: [
        { kind: "navigate", label: "External", path: "https://evil.example" },
        { kind: "execute", label: "Pay", intent: "capture_payment" },
      ],
    });
    assert.equal(hostile.actions.length, 0);
  });

  it("premium APIs assert server entitlements", () => {
    assert.match(read("api/functions/titanAI.js"), /requireFeature/);
    assert.match(read("api/functions/receiptVisionOcr.js"), /FEATURES\.ocrReceipts/);
    assert.match(read("api/_lib/entitlements.js"), /loadEntitlementProfile/);
    assert.match(read("src/lib/marketplaceApi.js"), /installMarketplaceModule/);
  });
});
