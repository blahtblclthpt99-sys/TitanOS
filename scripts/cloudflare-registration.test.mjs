import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import registerHandler from "../api/register.js";

const ENV_KEYS = [
  "TITANOS_ENV",
  "DEPLOYMENT_ENV",
  "ENVIRONMENT",
  "NODE_ENV",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function clearPrivilegedRateLimitEnv() {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.SUPABASE_URL;
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function mockRes() {
  return {
    statusCode: 200,
    body: undefined,
    headers: new Map(),
    setHeader(name, value) {
      this.headers.set(String(name).toLowerCase(), value);
      return this;
    },
    status(code) {
      this.statusCode = Number(code);
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    end() {
      return this;
    },
  };
}

function request({ method = "POST", body = {}, url = "/api/register" } = {}) {
  return {
    method,
    url,
    headers: {},
    body,
    rawBody: Buffer.from(JSON.stringify(body)),
    socket: { remoteAddress: "203.0.113.10" },
    connection: { remoteAddress: "203.0.113.10" },
  };
}

describe("Cloudflare registration migration safety", () => {
  it("rejects unsupported methods before mutation", async () => {
    process.env.TITANOS_ENV = "preview";
    clearPrivilegedRateLimitEnv();
    const res = mockRes();

    await registerHandler(request({ method: "GET" }), res);

    assert.equal(res.statusCode, 405);
    assert.deepEqual(res.body, { error: "Method not allowed" });
  });

  it("rejects malformed registration input without privileged credentials", async () => {
    process.env.TITANOS_ENV = "preview";
    clearPrivilegedRateLimitEnv();
    const res = mockRes();

    await registerHandler(
      request({ body: { email: "not-an-email", password: "validlength" } }),
      res,
    );

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: "Valid email is required" });
  });

  it("fails closed in production when durable rate limiting is unavailable", async () => {
    process.env.TITANOS_ENV = "production";
    clearPrivilegedRateLimitEnv();
    const res = mockRes();

    await registerHandler(
      request({ body: { email: "safe-test@example.com", password: "validlength" } }),
      res,
    );

    assert.equal(res.statusCode, 503);
    assert.match(String(res.body?.error || ""), /protection is temporarily unavailable/i);
    assert.equal(res.headers.get("retry-after"), "60");
  });
});
