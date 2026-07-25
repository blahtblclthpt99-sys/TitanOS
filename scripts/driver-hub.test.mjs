/**
 * Driver Hub mileage / fuel math unit tests.
 * Run: node --test scripts/driver-hub.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calcFuelCost,
  estimateShiftEarnings,
  parseMilesInput,
  IRS_MILEAGE_RATE_USD,
  summarizeRecordedShifts,
} from "../src/lib/driverHubMath.js";

describe("parseMilesInput", () => {
  it("accepts valid miles", () => {
    assert.equal(parseMilesInput("12.5").miles, 12.5);
    assert.equal(parseMilesInput(0).miles, 0);
  });
  it("rejects negative and NaN", () => {
    assert.equal(parseMilesInput("-1").ok, false);
    assert.equal(parseMilesInput("abc").ok, false);
    assert.equal(parseMilesInput("").ok, false);
  });
  it("rejects huge values", () => {
    assert.equal(parseMilesInput("100000").ok, false);
  });
});

describe("calcFuelCost", () => {
  it("computes gallons and cost", () => {
    const f = calcFuelCost({ miles: 100, mpg: 25, gasPriceLocal: 4, currency: "USD" });
    assert.equal(f.gallons, 4);
    assert.equal(f.cost, 16);
    assert.equal(f.perMile, 0.16);
  });
  it("guards zero mpg", () => {
    const f = calcFuelCost({ miles: 50, mpg: 0, gasPriceLocal: 3, currency: "USD" });
    assert.ok(f.gallons > 0);
  });
});

describe("estimateShiftEarnings", () => {
  it("scales with miles and time", () => {
    const a = estimateShiftEarnings({ miles: 10, elapsedSec: 3600, stops: 2 });
    const b = estimateShiftEarnings({ miles: 0, elapsedSec: 0, stops: 0 });
    assert.ok(a.gross > b.gross);
    assert.equal(b.gross, 0);
  });
});

describe("summarizeRecordedShifts", () => {
  it("sums archived shift numbers", () => {
    const s = summarizeRecordedShifts([
      {
        miles: 10,
        stops: 2,
        jobs_completed: 2,
        hours: 1,
        earnings_gross: 30,
        fuel_cost: 4,
        profit: 26,
        tax_estimate: 6.7,
      },
      {
        miles: 5.5,
        stops: 1,
        jobs_completed: 1,
        hours: 0.5,
        earnings_gross: 12,
        fuel_cost: 2,
        profit: 10,
        tax_estimate: 3.69,
      },
    ]);
    assert.equal(s.shifts, 2);
    assert.equal(s.miles, 15.5);
    assert.equal(s.stops, 3);
    assert.equal(s.jobsCompleted, 3);
    assert.equal(s.hours, 1.5);
  });
});

describe("IRS rate constant", () => {
  it("is positive", () => {
    assert.ok(IRS_MILEAGE_RATE_USD > 0);
  });
});
