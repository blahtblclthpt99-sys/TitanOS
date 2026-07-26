/**
 * MPP helper unit tests (no live Stripe calls).
 * Run: node --test scripts/mpp-helpers.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PATH_USD_MAINNET,
  PATH_USD_TESTNET,
  depositIdempotencyKey,
  getMppChargeAmounts,
  getMppPublicStatus,
  getPathUsdToken,
  isAllowedSptCurrency,
  isExpectedMppGap,
  isMppConfigured,
  isMppTestnet,
  isValidEvmAddress,
  isValidStripeProfileId,
  publicMppError,
  usdToCents,
} from "../api/_lib/mppStripe.js";

describe("isValidEvmAddress", () => {
  it("accepts 40-hex addresses", () => {
    assert.equal(isValidEvmAddress("0x20c0000000000000000000000000000000000000"), true);
    assert.equal(isValidEvmAddress("0xAbCdEf0123456789aBcDeF0123456789aBcDeF01"), true);
    assert.equal(isValidEvmAddress(PATH_USD_TESTNET), true);
    assert.equal(isValidEvmAddress(PATH_USD_MAINNET), true);
  });
  it("rejects junk", () => {
    assert.equal(isValidEvmAddress("0x123"), false);
    assert.equal(isValidEvmAddress("not-an-address"), false);
    assert.equal(isValidEvmAddress(null), false);
    assert.equal(isValidEvmAddress(undefined), false);
    assert.equal(isValidEvmAddress(""), false);
    assert.equal(isValidEvmAddress("0x" + "g".repeat(40)), false);
    assert.equal(isValidEvmAddress("0x" + "a".repeat(39)), false);
    assert.equal(isValidEvmAddress("0x" + "a".repeat(41)), false);
  });
});

describe("isValidStripeProfileId", () => {
  it("accepts profile_ ids", () => {
    assert.equal(isValidStripeProfileId("profile_abc123XYZ"), true);
    assert.equal(isValidStripeProfileId("profile_test_61UQtAVw2yEA80y4mA6"), true);
    assert.equal(isValidStripeProfileId("  profile_abc123XYZ  "), true);
  });
  it("rejects other shapes", () => {
    assert.equal(isValidStripeProfileId("pk_live_x"), false);
    assert.equal(isValidStripeProfileId(""), false);
    assert.equal(isValidStripeProfileId("profile_"), false);
    assert.equal(isValidStripeProfileId("profile"), false);
    assert.equal(isValidStripeProfileId("PROFILE_abc"), false);
    assert.equal(isValidStripeProfileId("profile_abc-def"), false);
    assert.equal(isValidStripeProfileId(null), false);
    assert.equal(isValidStripeProfileId(123), false);
  });
});

describe("usdToCents", () => {
  it("converts and clamps", () => {
    assert.equal(usdToCents("0.01"), 1);
    assert.equal(usdToCents("0.50"), 50);
    assert.equal(usdToCents(1), 100);
    assert.equal(usdToCents("999", { maxCents: 500 }), 500);
    assert.equal(usdToCents("0.001", { minCents: 1 }), 1);
    assert.equal(usdToCents("nope", { fallbackCents: 1 }), 1);
    assert.equal(usdToCents(-5, { fallbackCents: 7 }), 7);
    assert.equal(usdToCents(NaN, { fallbackCents: 9 }), 9);
    assert.equal(usdToCents("x".repeat(40), { fallbackCents: 3 }), 3);
  });
});

describe("currency + network helpers", () => {
  it("allows usd only for SPT", () => {
    assert.equal(isAllowedSptCurrency("usd"), true);
    assert.equal(isAllowedSptCurrency("USD"), true);
    assert.equal(isAllowedSptCurrency("eur"), false);
    assert.equal(isAllowedSptCurrency(""), false);
  });
  it("defaults to testnet token", () => {
    assert.equal(isMppTestnet(), true);
    assert.equal(getPathUsdToken(), PATH_USD_TESTNET);
  });
});

describe("getMppChargeAmounts", () => {
  it("returns bounded defaults", () => {
    const a = getMppChargeAmounts();
    assert.equal(a.tempoUsd, "0.01");
    assert.equal(a.stripeUsd, "0.50");
    assert.equal(a.tempoCents, 1);
    assert.equal(a.stripeCents, 50);
    assert.equal(a.stripeCurrency, "usd");
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
  it("maps crypto unavailable codes", () => {
    const err = new Error("unknown");
    err.code = "parameter_unknown";
    const pub = publicMppError(err);
    assert.equal(pub.status, 502);
    assert.equal(pub.code, "crypto_unavailable");
  });
  it("maps auth too large", () => {
    const err = new Error("too big");
    err.code = "MPP_AUTH_TOO_LARGE";
    const pub = publicMppError(err);
    assert.equal(pub.status, 431);
  });
  it("maps timeouts", () => {
    const err = new Error("aborted");
    err.code = "AbortError";
    const pub = publicMppError(err);
    assert.equal(pub.status, 504);
  });
  it("maps rate limits", () => {
    const err = new Error("slow down");
    err.code = "rate_limit";
    const pub = publicMppError(err);
    assert.equal(pub.status, 429);
  });
});

describe("isExpectedMppGap", () => {
  it("flags operational gaps", () => {
    assert.equal(isExpectedMppGap("parameter_unknown"), true);
    assert.equal(isExpectedMppGap("crypto_unavailable"), true);
    assert.equal(isExpectedMppGap("MPP_NOT_CONFIGURED"), true);
    assert.equal(isExpectedMppGap("mpp_internal"), false);
    assert.equal(isExpectedMppGap(""), false);
  });
});

describe("depositIdempotencyKey", () => {
  it("is stable for same inputs", () => {
    const req = new Request("https://titanos-web.vercel.app/api/functions/mppPaid?x=1");
    const a = depositIdempotencyKey(req, 1);
    const b = depositIdempotencyKey(req, 1);
    assert.equal(a, b);
    assert.match(a, /^mpp-dep-[a-f0-9]{32}$/);
    const c = depositIdempotencyKey(req, 50);
    assert.notEqual(a, c);
  });
});

describe("getMppPublicStatus", () => {
  it("exposes non-secret config", () => {
    const s = getMppPublicStatus();
    assert.equal(typeof s.configured, "boolean");
    assert.equal(typeof s.profileEnv, "boolean");
    assert.equal(typeof s.testnet, "boolean");
    assert.ok(s.amounts.tempoUsd);
    assert.ok(s.pathUsd.startsWith("0x"));
    assert.equal(isMppConfigured(), s.configured);
  });
});
