/**
 * Payment security unit tests — client status + origin allowlist + Stripe reconciliation metadata.
 * Run: node --test scripts/payment-security.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveAppOrigin, allowedOrigins } from "../api/_lib/cors.js";

const PRODUCTION_ORIGIN = "https://app.titanfieldos.com";
const RETIRED_VERCEL_ORIGIN = "https://titanos-web.vercel.app";
const WEBHOOK_ONLY = new Set(["succeeded", "refunded", "paid"]);
const CLIENT_ALLOWED = new Set(["pending", "canceled", "failed", "cancelled"]);
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

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
  it("includes only the canonical production origin, not the retired Vercel host", () => {
    assert.ok(allowedOrigins().includes(PRODUCTION_ORIGIN));
    assert.equal(allowedOrigins().includes(RETIRED_VERCEL_ORIGIN), false);
  });
  it("accepts the canonical production Origin header", () => {
    assert.equal(
      resolveAppOrigin({ headers: { origin: PRODUCTION_ORIGIN } }),
      PRODUCTION_ORIGIN
    );
  });
  it("rejects spoofed and retired Origin headers by falling back to the canonical origin", () => {
    assert.equal(
      resolveAppOrigin({ headers: { origin: "https://evil.example" } }),
      PRODUCTION_ORIGIN
    );
    assert.equal(
      resolveAppOrigin({ headers: { origin: RETIRED_VERCEL_ORIGIN } }),
      PRODUCTION_ORIGIN
    );
  });
});

describe("Stripe reconciliation metadata", () => {
  it("propagates standard payment identifiers to the underlying PaymentIntent", async () => {
    const source = await read("api/functions/createPaymentLink.js");
    assert.match(source, /payment_intent_data\[metadata\]\[payment_id\]/);
    assert.match(source, /payment_intent_data\[metadata\]\[user_id\]/);
    assert.match(source, /payment_intent_data\[metadata\]\[invoice_id\]/);
  });

  it("propagates Titan Auto order identifiers to the underlying PaymentIntent", async () => {
    const source = await read("api/functions/createAutopilotOrder.js");
    assert.match(source, /payment_intent_data: \{ metadata: reconciliationMetadata \}/);
    assert.match(source, /payment_id: payment\.id/);
    assert.match(source, /user_id: auth\.user\.id/);
  });
});
