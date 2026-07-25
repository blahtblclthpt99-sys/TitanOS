/**
 * Payment security unit tests — client status + origin allowlist (live cors module).
 * Run: node --test scripts/payment-security.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveAppOrigin, allowedOrigins } from "../api/_lib/cors.js";

const WEBHOOK_ONLY = new Set(["succeeded", "refunded", "paid"]);
const CLIENT_ALLOWED = new Set(["pending", "canceled", "failed", "cancelled"]);

function clientMaySetStatus(status) {
  const normalized = String(status || "").toLowerCase();
  if (WEBHOOK_ONLY.has(normalized)) return false;
  return CLIENT_ALLOWED.has(normalized);
}

describe("payment status client policy", () => {
  it("blocks succeeded / refunded from client", () => {
    assert.equal(clientMaySetStatus("succeeded"), false);
    assert.equal(clientMaySetStatus("refunded"), false);
    assert.equal(clientMaySetStatus("paid"), false);
  });
  it("allows cancel/fail/pending", () => {
    assert.equal(clientMaySetStatus("canceled"), true);
    assert.equal(clientMaySetStatus("failed"), true);
    assert.equal(clientMaySetStatus("pending"), true);
  });
});

describe("checkout return origin allowlist (cors module)", () => {
  it("includes production origin", () => {
    assert.ok(allowedOrigins().includes("https://titanos-web.vercel.app"));
  });
  it("accepts allowlisted Origin header", () => {
    assert.equal(
      resolveAppOrigin({ headers: { origin: "https://titanos-web.vercel.app" } }),
      "https://titanos-web.vercel.app"
    );
  });
  it("rejects spoofed Origin header", () => {
    assert.equal(
      resolveAppOrigin({ headers: { origin: "https://evil.example" } }),
      "https://titanos-web.vercel.app"
    );
  });
});
