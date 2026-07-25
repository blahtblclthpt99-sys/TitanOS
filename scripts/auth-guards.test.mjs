/**
 * Auth / entity money guards — mirrors client allowlists used in production.
 * Run: node --test scripts/auth-guards.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const PROFILE_ALLOWED = new Set([
  "full_name",
  "phone",
  "username",
  "avatar_url",
  "bio",
  "city",
  "state",
  "company_name",
  "company_address",
  "company_city",
  "company_state",
  "company_zip",
  "company_logo_url",
  "theme_pref",
  "notification_prefs",
  "marketing_prefs",
  "privacy_prefs",
  "professional_profile",
  "community_opt_in",
  "referral_code",
  "referred_by_code",
  "active_company_id",
]);

const PROFILE_FORBIDDEN = [
  "role",
  "is_pro",
  "lifetime_premium",
  "paying_subscriber",
  "plan_tier",
  "account_type",
  "verified_worker",
  "verification_notes",
];

function filterUpdateMe(updates) {
  const payload = {};
  for (const key of PROFILE_ALLOWED) {
    if (updates[key] !== undefined) payload[key] = updates[key];
  }
  return payload;
}

const WEBHOOK_ONLY_PAYMENT = new Set(["succeeded", "refunded", "paid"]);

function entityAdapterBlocksPaymentStatus(status) {
  return WEBHOOK_ONLY_PAYMENT.has(String(status || "").toLowerCase());
}

function entityAdapterBlocksInvoicePaid(status) {
  return String(status || "").toLowerCase() === "paid";
}

describe("updateMe privilege allowlist", () => {
  it("keeps safe profile fields", () => {
    const out = filterUpdateMe({ full_name: "Ada", phone: "555" });
    assert.equal(out.full_name, "Ada");
    assert.equal(out.phone, "555");
  });
  it("strips privilege / billing fields", () => {
    const out = filterUpdateMe({
      full_name: "Ada",
      role: "admin",
      is_pro: true,
      plan_tier: "enterprise",
      paying_subscriber: true,
    });
    assert.equal(out.full_name, "Ada");
    for (const key of PROFILE_FORBIDDEN) {
      assert.equal(out[key], undefined);
    }
  });
});

describe("entity adapter money guards", () => {
  it("blocks payment succeeded/refunded/paid", () => {
    assert.equal(entityAdapterBlocksPaymentStatus("succeeded"), true);
    assert.equal(entityAdapterBlocksPaymentStatus("refunded"), true);
    assert.equal(entityAdapterBlocksPaymentStatus("pending"), false);
  });
  it("blocks invoice paid", () => {
    assert.equal(entityAdapterBlocksInvoicePaid("paid"), true);
    assert.equal(entityAdapterBlocksInvoicePaid("sent"), false);
  });
});
