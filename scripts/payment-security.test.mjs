/**
 * Payment security unit tests — client status + origin allowlist (live cors module).
 * Run: node --test scripts/payment-security.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveAppOrigin, allowedOrigins } from "../api/_lib/cors.js";

const WEBHOOK_ONLY = new Set(["succeeded", "refunded", "paid"]);
const CLIENT_ALLOWED = new Set(["pending", "canceled", "failed", "cancelled"]);
const PRODUCTION_ORIGIN = "https://titanfieldos.com";

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
  it("includes TitanfieldOS production origin", () => {
    assert.ok(allowedOrigins().includes(PRODUCTION_ORIGIN));
  });
  it("accepts allowlisted TitanfieldOS Origin header", () => {
    assert.equal(
      resolveAppOrigin({ headers: { origin: PRODUCTION_ORIGIN } }),
      PRODUCTION_ORIGIN
    );
  });
  it("rejects spoofed Origin header and falls back to TitanfieldOS", () => {
    assert.equal(
      resolveAppOrigin({ headers: { origin: "https://evil.example" } }),
      PRODUCTION_ORIGIN
    );
  });
});