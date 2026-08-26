/**
 * Auth / entity money guards — mirrors client allowlists used in production.
 * Run: node --test scripts/auth-guards.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

describe("server admin authorization boundary", () => {
  const authSource = readFileSync(new URL("../api/_lib/auth.js", import.meta.url), "utf8");
  const migrationSource = readFileSync(
    new URL("../supabase/migrations/20260816_lock_profile_privileged_columns.sql", import.meta.url),
    "utf8"
  );

  it("trusts immutable auth app_metadata and never profiles.role", () => {
    assert.match(authSource, /app_metadata\?\.role\s*===\s*["']admin["']/);
    assert.doesNotMatch(authSource, /from\(["']profiles["']\)[\s\S]*select\(["']role["']\)/);
  });

  it("revokes table-wide profile UPDATE and grants only bounded columns", () => {
    assert.match(migrationSource, /revoke\s+update\s+on\s+table\s+public\.profiles\s+from\s+authenticated/i);
    const grant = migrationSource.match(/grant\s+update\s*\(([\s\S]*?)\)\s+on\s+table\s+public\.profiles\s+to\s+authenticated/i)?.[1] || "";
    assert.ok(grant, "bounded authenticated UPDATE grant must exist");
    for (const forbidden of [
      ...PROFILE_FORBIDDEN,
      "founding_member",
      "founding_tier",
      "is_founding_titan",
      "marketplace_pack_unlocked",
    ]) {
      assert.equal(new RegExp(`\\b${forbidden}\\b`, "i").test(grant), false, `${forbidden} must remain server-owned`);
    }
  });
});

describe("registration abuse boundary", () => {
  const registerSource = readFileSync(new URL("../api/register.js", import.meta.url), "utf8");

  it("requires the durable fail-closed rate limiter", () => {
    assert.match(registerSource, /assertRateLimitAsync/);
    assert.match(registerSource, /requireDurable\s*:\s*true/);
    assert.doesNotMatch(registerSource, /\bassertRateLimit\s*\(/);
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
