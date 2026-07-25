/**
 * Automated Fee Engine tests (Node built-in test runner).
 * Run: node --test scripts/fee-engine.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateFees,
  formatFeePercent,
  pickSeedRule,
  roundMoney,
} from "../shared/feeEngine.js";

describe("roundMoney", () => {
  it("rounds to cents", () => {
    assert.equal(roundMoney(1.005), 1.01);
    assert.equal(roundMoney(10.999), 11);
    assert.equal(roundMoney("12.345"), 12.35);
  });
  it("handles invalid", () => {
    assert.equal(roundMoney(NaN), 0);
    assert.equal(roundMoney(undefined), 0);
  });
});

describe("percentage fees", () => {
  it("applies 8% worker free", () => {
    const rule = pickSeedRule("service_requests", "worker_free");
    const r = calculateFees({ grossAmount: 100, rule });
    assert.equal(r.platformFee, 8);
    assert.equal(r.finalTotal, 108);
    assert.equal(r.netAmount, 100);
  });
  it("applies 2.5% premium", () => {
    const rule = pickSeedRule("service_requests", "worker_premium");
    const r = calculateFees({ grossAmount: 200, rule });
    assert.equal(r.platformFee, 5);
    assert.equal(r.finalTotal, 205);
  });
  it("applies 0% customer", () => {
    const rule = pickSeedRule("service_requests", "customer");
    const r = calculateFees({ grossAmount: 50, rule });
    assert.equal(r.platformFee, 0);
    assert.equal(r.finalTotal, 50);
  });
});

describe("flat fees", () => {
  it("featured listing is free", () => {
    const rule = pickSeedRule("featured_listings", "*");
    const r = calculateFees({ grossAmount: 0, rule });
    assert.equal(r.platformFee, 0);
    assert.equal(r.finalTotal, 0);
  });
});

describe("marketplace fees", () => {
  it("marketplace sales are 0%", () => {
    const rule = pickSeedRule("marketplace_sales", "*");
    const r = calculateFees({ grossAmount: 100, rule });
    assert.equal(r.platformFee, 0);
    assert.equal(r.finalTotal, 100);
  });
});

describe("min / max fees", () => {
  it("enforces minimum", () => {
    const r = calculateFees({
      grossAmount: 10,
      rule: {
        enabled: true,
        rule_type: "percentage",
        percentage_rate: 0.01,
        min_fee: 2,
        fee_bearer: "buyer",
      },
    });
    assert.equal(r.platformFee, 2);
  });
  it("enforces maximum", () => {
    const r = calculateFees({
      grossAmount: 10000,
      rule: {
        enabled: true,
        rule_type: "percentage",
        percentage_rate: 0.08,
        max_fee: 50,
        fee_bearer: "buyer",
      },
    });
    assert.equal(r.platformFee, 50);
  });
});

describe("tiered + promo + tax + seller bearer", () => {
  it("uses matching tier", () => {
    const r = calculateFees({
      grossAmount: 150,
      rule: {
        enabled: true,
        rule_type: "tiered",
        tiers: [
          { min: 0, max: 100, rate: 0.1 },
          { min: 100.01, max: null, rate: 0.05 },
        ],
        fee_bearer: "buyer",
      },
    });
    assert.equal(r.rate, 0.05);
    assert.equal(r.platformFee, 7.5);
  });
  it("applies percent_off promo", () => {
    const r = calculateFees({
      grossAmount: 100,
      rule: {
        enabled: true,
        rule_type: "percentage",
        percentage_rate: 0.1,
        promo: { percent_off: 0.5 },
        fee_bearer: "buyer",
      },
    });
    assert.equal(r.platformFee, 5);
  });
  it("adds tax when enabled", () => {
    const r = calculateFees({
      grossAmount: 100,
      rule: {
        enabled: true,
        rule_type: "percentage",
        percentage_rate: 0.1,
        tax_enabled: true,
        tax_rate: 0.05,
        fee_bearer: "buyer",
      },
    });
    assert.equal(r.platformFee, 10);
    assert.equal(r.taxAmount, 5.5);
    assert.equal(r.finalTotal, 115.5);
  });
  it("seller bearer deducts from net", () => {
    const r = calculateFees({
      grossAmount: 100,
      rule: {
        enabled: true,
        rule_type: "percentage",
        percentage_rate: 0.1,
        fee_bearer: "seller",
      },
    });
    assert.equal(r.finalTotal, 100);
    assert.equal(r.netAmount, 90);
  });
});

describe("edge cases", () => {
  it("rejects negative gross", () => {
    assert.throws(() =>
      calculateFees({
        grossAmount: -1,
        rule: { enabled: true, rule_type: "percentage", percentage_rate: 0.1 },
      })
    );
  });
  it("handles zero", () => {
    const r = calculateFees({
      grossAmount: 0,
      rule: pickSeedRule("service_requests", "worker_free"),
    });
    assert.equal(r.finalTotal, 0);
  });
  it("handles large amounts", () => {
    const r = calculateFees({
      grossAmount: 1_000_000,
      rule: pickSeedRule("service_requests", "business"),
    });
    assert.equal(r.platformFee, 15000);
    assert.equal(r.finalTotal, 1_015_000);
  });
  it("small fractional amounts", () => {
    const r = calculateFees({
      grossAmount: 0.01,
      rule: pickSeedRule("service_requests", "worker_free"),
    });
    assert.equal(r.platformFee, 0);
    assert.equal(r.finalTotal, 0.01);
  });
  it("disabled rule = zero fee", () => {
    const r = calculateFees({
      grossAmount: 100,
      rule: { enabled: false, percentage_rate: 0.5 },
    });
    assert.equal(r.platformFee, 0);
    assert.equal(r.finalTotal, 100);
  });
  it("formatFeePercent", () => {
    assert.equal(formatFeePercent(0.08), "8%");
    assert.equal(formatFeePercent(0.025), "2.5%");
  });
});
