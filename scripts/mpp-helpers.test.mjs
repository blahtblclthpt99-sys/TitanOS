/**
 * MPP helper unit tests (no live Stripe calls).
 * Run: node --test scripts/mpp-helpers.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getMppChargeAmounts,
  isValidEvmAddress,
  isValidStripeProfileId,
  publicMppError,
  usdToCents,
} from "../api/_lib/mppStripe.js";

describe("isValidEvmAddress", () => {
  it("accepts 40-hex addresses", () => {
    assert.equal(isValidEvmAddress("0x20c0000000000000000000000000000000000000"), true);
    assert.equal(isValidEvmAddress("0xAbCdEf0123456789aBcDeF0123456789aBcDeF01"), true);
  });
  it("rejects junk", () => {
    assert.equal(isValidEvmAddress("0x123"), false);
    assert.equal(isValidEvmAddress("not-an-address"), false);
    assert.equal(isValidEvmAddress(null), false);
  });
});

describe("isValidStripeProfileId", () => {
  it("accepts profile_ ids", () => {
    assert.equal(isValidStripeProfileId("profile_abc123XYZ"), true);
  });
  it("rejects other shapes", () => {
    assert.equal(isValidStripeProfileId("pk_live_x"), false);
    assert.equal(isValidStripeProfileId(""), false);
    assert.equal(isValidStripeProfileId("profile_"), false);
  });
});

describe("usdToCents", () => {
  it("converts and clamps", () => {
    assert.equal(usdToCents("0.01"), 1);
    assert.equal(usdToCents("0.50"), 50);
    assert.equal(usdToCents("999", { maxCents: 500 }), 500);
    assert.equal(usdToCents("nope", { fallbackCents: 1 }), 1);
  });
});

describe("getMppChargeAmounts", () => {
  it("returns bounded defaults", () => {
    const a = getMppChargeAmounts();
    assert.equal(a.tempoUsd, "0.01");
    assert.equal(a.stripeUsd, "0.50");
  });
});

describe("publicMppError", () => {
  it("does not leak internal messages", () => {
    const err = new Error("sk_live_super_secret exploded");
    err.code = "MPP_DEPOSIT_ADDRESS_MISSING";
    const pub = publicMppError(err);
    assert.equal(pub.status, 502);
    assert.ok(!String(pub.error).includes("sk_live"));
    assert.equal(pub.code, "MPP_DEPOSIT_ADDRESS_MISSING");
  });
});
