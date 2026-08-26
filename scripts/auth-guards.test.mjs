/**
 * Auth / entity money guards — mirrors client allowlists used in production.
 * Run: node --test scripts/auth-guards.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sanitizeReturnPath } from "../src/lib/returnTo.js";
import { assertRateLimitAsync } from "../api/_lib/rateLimit.js";

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

function createResponseProbe() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
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

  it("uses one atomic Upstash EVAL and returns the remaining TTL when denied", async () => {
    const originalFetch = globalThis.fetch;
    const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
    const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    let command;
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "https://redis.invalid");
      command = JSON.parse(init.body);
      return {
        ok: true,
        async json() {
          return { result: [9, 42] };
        },
      };
    };

    try {
      const res = createResponseProbe();
      const allowed = await assertRateLimitAsync(
        { headers: { "x-forwarded-for": "203.0.113.10" }, url: "/register" },
        res,
        { limit: 8, windowMs: 60_000, key: "register", requireDurable: true },
      );
      assert.equal(allowed, false);
      assert.equal(res.statusCode, 429);
      assert.equal(res.headers["Retry-After"], "42");
      assert.equal(command[0], "EVAL");
      assert.equal(command[2], "1");
      assert.match(command[1], /count == 1/);
      assert.match(command[1], /EXPIRE/);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
      else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
      if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
      else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    }
  });
});

describe("auth return-target boundary", () => {
  it("preserves normal in-app destinations", () => {
    assert.equal(sanitizeReturnPath("/jobs?tab=matched#top"), "/jobs?tab=matched#top");
    assert.equal(sanitizeReturnPath("driver"), "/driver");
  });

  it("rejects protocol-relative, URI-scheme, control-character, and oversized targets", () => {
    assert.equal(sanitizeReturnPath("//evil.example/path"), null);
    assert.equal(sanitizeReturnPath("\\\\evil.example\\share"), null);
    assert.equal(sanitizeReturnPath("javascript:alert(1)"), null);
    assert.equal(sanitizeReturnPath("/jobs\u0000admin"), null);
    assert.equal(sanitizeReturnPath(`/${"a".repeat(600)}`), null);
  });

  it("does not return auth routes as post-auth destinations", () => {
    assert.equal(sanitizeReturnPath("/login"), "/");
    assert.equal(sanitizeReturnPath("/auth/callback?code=secret"), "/");
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
