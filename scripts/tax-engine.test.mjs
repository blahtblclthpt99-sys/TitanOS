/**
 * Tax Engine + Job Location vs Driver Location separation tests.
 * Run: node --test scripts/tax-engine.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SEED_TAX_RULES,
  calculateSalesTax,
  resolveJurisdiction,
} from "../shared/taxEngine.js";
import {
  computeTravelSummary,
  haversineMiles,
  normalizeJobLocation,
} from "../shared/jobLocation.js";

const lines = [{ description: "Labor", quantity: 1, unit_price: 100, total: 100 }];

describe("Job Location tax jurisdiction", () => {
  it("resolves Dallas TX to local rate (not state-only)", () => {
    const j = resolveJurisdiction(
      { city: "Dallas", state: "TX", zip: "75201", country: "US" },
      SEED_TAX_RULES
    );
    assert.equal(j.ok, true);
    assert.equal(j.ratePercent, 8.25);
    assert.match(j.rule.id, /dallas/i);
  });

  it("resolves state-only when city unknown", () => {
    const j = resolveJurisdiction({ city: "Waco", state: "TX", country: "US" }, SEED_TAX_RULES);
    assert.equal(j.ok, true);
    assert.equal(j.ratePercent, 6.25);
  });

  it("distinguishes border Texarkana TX vs AR", () => {
    const tx = resolveJurisdiction(
      { city: "Texarkana", state: "TX", zip: "75501" },
      SEED_TAX_RULES
    );
    const ar = resolveJurisdiction(
      { city: "Texarkana", state: "AR", zip: "71854" },
      SEED_TAX_RULES
    );
    assert.equal(tx.ok, true);
    assert.equal(ar.ok, true);
    assert.notEqual(tx.ratePercent, ar.ratePercent);
    assert.match(tx.rule.id, /tx/i);
    assert.match(ar.rule.id, /ar/i);
  });

  it("resolves NYC and Chicago differently", () => {
    const nyc = resolveJurisdiction(
      { city: "New York", state: "NY", zip: "10001" },
      SEED_TAX_RULES
    );
    const chi = resolveJurisdiction(
      { city: "Chicago", state: "IL", zip: "60601" },
      SEED_TAX_RULES
    );
    assert.equal(nyc.ratePercent, 8.875);
    assert.equal(chi.ratePercent, 10.25);
  });
});

describe("calculateSalesTax", () => {
  it("taxes from Job Location; tax changes when Job Location changes", () => {
    const dallas = calculateSalesTax({
      lineItems: lines,
      jobLocation: { city: "Dallas", state: "TX", zip: "75201" },
      rules: SEED_TAX_RULES,
    });
    const waco = calculateSalesTax({
      lineItems: lines,
      jobLocation: { city: "Waco", state: "TX" },
      rules: SEED_TAX_RULES,
    });
    assert.equal(dallas.taxAmount, 8.25);
    assert.equal(waco.taxAmount, 6.25);
    assert.notEqual(dallas.taxAmount, waco.taxAmount);
  });

  it("same Job Location yields same tax for different drivers (driver irrelevant)", () => {
    const job = { city: "Austin", state: "TX", zip: "78701" };
    const a = calculateSalesTax({ lineItems: lines, jobLocation: job, rules: SEED_TAX_RULES });
    const b = calculateSalesTax({ lineItems: lines, jobLocation: job, rules: SEED_TAX_RULES });
    assert.equal(a.taxRate, b.taxRate);
    assert.equal(a.taxAmount, b.taxAmount);
    assert.equal(a.snapshot.source, "job_location");
  });

  it("supports tax-exempt", () => {
    const r = calculateSalesTax({
      lineItems: lines,
      jobLocation: { city: "Dallas", state: "TX", zip: "75201" },
      rules: SEED_TAX_RULES,
      taxExempt: true,
    });
    assert.equal(r.taxAmount, 0);
    assert.equal(r.total, 100);
    assert.equal(r.taxExempt, true);
  });

  it("keeps historical snapshot rates when recalculate=false", () => {
    const created = calculateSalesTax({
      lineItems: lines,
      jobLocation: { city: "Dallas", state: "TX", zip: "75201" },
      rules: SEED_TAX_RULES,
    });
    const frozen = calculateSalesTax({
      lineItems: lines,
      jobLocation: { city: "Chicago", state: "IL", zip: "60601" },
      rules: SEED_TAX_RULES,
      snapshot: created.snapshot,
      recalculate: false,
    });
    assert.equal(frozen.taxRate, 8.25);
    assert.equal(frozen.taxAmount, 8.25);
    assert.match(frozen.jurisdiction.message, /historical/i);
  });
});

describe("Driver Location vs Job Location travel", () => {
  it("computes miles between driver and job without affecting tax", () => {
    const driver = { lat: 32.7767, lng: -96.797, maxServiceRadiusMi: 50 };
    const job = normalizeJobLocation({
      city: "Fort Worth",
      state: "TX",
      lat: 32.7555,
      lng: -97.3308,
    });
    const miles = haversineMiles(driver, job);
    assert.ok(miles > 20 && miles < 50);
    const travel = computeTravelSummary(driver, job);
    assert.equal(travel.ready, true);
    assert.equal(travel.withinRadius, true);

    const tax = calculateSalesTax({
      lineItems: lines,
      jobLocation: job,
      rules: SEED_TAX_RULES,
    });
    // Fort Worth not in seed as city → TX state 6.25
    assert.equal(tax.taxRate, 6.25);
  });
});
