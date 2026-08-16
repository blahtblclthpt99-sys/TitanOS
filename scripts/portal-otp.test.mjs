import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hashPortalOtp, portalOtpMatches } from "../api/_lib/portalOtp.js";
import { assertRateLimitAsync } from "../api/_lib/rateLimit.js";

function mockReq(ip = "203.0.113.10") {
  return { headers: { "x-forwarded-for": ip }, socket: { remoteAddress: ip }, url: "/api/functions/portalVerifyOtp" };
}
function mockRes() {
  return { statusCode: 200, headers: {}, body: null, setHeader(name, value) { this.headers[String(name).toLowerCase()] = String(value); }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
function saveEnv(names) { return Object.fromEntries(names.map((name) => [name, process.env[name]])); }
function restoreEnv(saved) { for (const [name, value] of Object.entries(saved)) { if (value == null) delete process.env[name]; else process.env[name] = value; } }

describe("portal OTP hashing", () => {
  it("hashes and matches", () => {
    const email = "a@example.com"; const code = "123456"; const hashed = hashPortalOtp(email, code);
    assert.notEqual(hashed, code); assert.equal(portalOtpMatches(hashed, email, code), true); assert.equal(portalOtpMatches(hashed, email, "000000"), false);
  });
  it("rejects legacy plaintext by default", () => { delete process.env.PORTAL_OTP_ALLOW_LEGACY; assert.equal(portalOtpMatches("654321", "b@example.com", "654321"), false); });
  it("accepts legacy plaintext when PORTAL_OTP_ALLOW_LEGACY=1", () => { process.env.PORTAL_OTP_ALLOW_LEGACY = "1"; assert.equal(portalOtpMatches("654321", "b@example.com", "654321"), true); assert.equal(portalOtpMatches("654321", "b@example.com", "111111"), false); delete process.env.PORTAL_OTP_ALLOW_LEGACY; });
});

describe("portal OTP durable throttling", () => {
  it("fails closed in production if no durable backend can be reached", async () => {
    const saved = saveEnv(["VERCEL_ENV", "NODE_ENV", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    try {
      process.env.VERCEL_ENV = "production"; process.env.NODE_ENV = "production";
      delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN; delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      const res = mockRes();
      const allowed = await assertRateLimitAsync(mockReq("203.0.113.21"), res, { limit: 8, windowMs: 60_000, key: "portalOtpProductionTest", requireDurable: true });
      assert.equal(allowed, false); assert.equal(res.statusCode, 503); assert.equal(res.headers["retry-after"], "60"); assert.match(String(res.body?.error || ""), /temporarily unavailable/i);
    } finally { restoreEnv(saved); }
  });

  it("retains local/test memory fallback", async () => {
    const saved = saveEnv(["VERCEL_ENV", "NODE_ENV", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    try {
      process.env.VERCEL_ENV = "development"; process.env.NODE_ENV = "test";
      delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN; delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      const res = mockRes();
      const allowed = await assertRateLimitAsync(mockReq("203.0.113.22"), res, { limit: 8, windowMs: 60_000, key: "portalOtpLocalTest", requireDurable: true });
      assert.equal(allowed, true); assert.equal(res.statusCode, 200);
    } finally { restoreEnv(saved); }
  });
});
