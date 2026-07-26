import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeTrueCostPerMile,
  estimateTrueOperatingCost,
  ultimateWorthPerMile,
  clampMaintenanceCents,
  MAINTENANCE_CENTS_MIN,
  MAINTENANCE_CENTS_MAX,
} from "../src/lib/driverActivity/trueCostPerMile.js";
import { analyzeOffer } from "../src/lib/driverActivity/offerAnalyzer.js";

describe("True cost per mile", () => {
  it("clamps maintenance to 10–13 cents", () => {
    assert.equal(clampMaintenanceCents(8), MAINTENANCE_CENTS_MIN);
    assert.equal(clampMaintenanceCents(20), MAINTENANCE_CENTS_MAX);
    assert.equal(clampMaintenanceCents(11.5), 11.5);
  });

  it("builds fuel + maint + tires + vehicle into all-in $/mi", () => {
    const c = computeTrueCostPerMile(
      {
        purchase_price: 30000,
        vehicle_life_miles: 150000,
        tire_set_cost: 800,
        tire_life_miles: 40000,
        tire_miles_used: 0,
        maintenance_cents_per_mile: 12,
      },
      { mpg: 20, gasUsd: 4 }
    );
    assert.equal(c.fuel_per_mile, 0.2);
    assert.equal(c.maintenance_cents, 12);
    assert.equal(c.maintenance_per_mile, 0.12);
    assert.ok(Math.abs(c.tires_per_mile - 800 / 40000) < 0.0001);
    assert.ok(Math.abs(c.depreciation_per_mile - 30000 / 150000) < 0.0001);
    assert.ok(c.true_cost_per_mile > 0.5);
  });

  it("raises tire $/mi as tires wear down", () => {
    const newT = computeTrueCostPerMile({
      tire_set_cost: 600,
      tire_life_miles: 40000,
      tire_miles_used: 0,
      purchase_price: 0,
      maintenance_cents_per_mile: 11,
    });
    const oldT = computeTrueCostPerMile({
      tire_set_cost: 600,
      tire_life_miles: 40000,
      tire_miles_used: 30000,
      purchase_price: 0,
      maintenance_cents_per_mile: 11,
    });
    assert.ok(oldT.tires_per_mile > newT.tires_per_mile);
  });

  it("estimates operating cost for N miles", () => {
    const op = estimateTrueOperatingCost(
      10,
      {
        purchase_price: 15000,
        vehicle_life_miles: 150000,
        tire_set_cost: 600,
        tire_life_miles: 40000,
        maintenance_cents_per_mile: 11.5,
      },
      { mpg: 25, gasUsd: 3.5 }
    );
    assert.equal(op.miles, 10);
    assert.ok(op.operating_cost > 0);
    assert.ok(op.fuel_cost > 0);
  });

  it("DENY when offer gross $/mi is under true-cost floor", () => {
    const r = analyzeOffer(
      {
        pay: 4,
        tip: 0,
        miles: 10,
        minutes: 30,
        parking: 0,
        deadhead_miles: 0,
      },
      { minHourlyAccept: 10, minProfitAccept: 0.5, minPerMileAccept: 0.3 },
      {
        economics: {
          purchase_price: 25000,
          vehicle_life_miles: 150000,
          tire_set_cost: 700,
          tire_life_miles: 40000,
          tire_miles_used: 0,
          maintenance_cents_per_mile: 12,
        },
      }
    );
    // $0.40/mi gross vs ~$0.50+ all-in
    assert.equal(r.verdict, "DENY");
    assert.equal(r.gates.trueCost, false);
    assert.ok(r.trueCost.true_cost_per_mile > 0.3);
  });

  it("ACCEPT when offer clears all-in cost per mile", () => {
    const r = analyzeOffer(
      {
        pay: 18,
        tip: 6,
        miles: 4,
        minutes: 16,
        parking: 0,
        deadhead_miles: 0.5,
      },
      { minHourlyAccept: 15, minProfitAccept: 2, minPerMileAccept: 0.5 },
      {
        economics: {
          purchase_price: 20000,
          vehicle_life_miles: 150000,
          tire_set_cost: 600,
          tire_life_miles: 40000,
          maintenance_cents_per_mile: 11,
        },
      }
    );
    assert.equal(r.verdict, "ACCEPT");
    assert.equal(r.gates.trueCost, true);
    assert.ok(r.breakdown.perMileGross > r.trueCost.recommended_min_gross_per_mile);
  });

  it("ultimateWorthPerMile recommends min above all-in", () => {
    const w = ultimateWorthPerMile({
      economics: {
        purchase_price: 10000,
        vehicle_life_miles: 100000,
        tire_set_cost: 500,
        tire_life_miles: 50000,
        maintenance_cents_per_mile: 10,
      },
      mpg: 25,
      gasUsd: 3.75,
      parking: 0,
      totalMiles: 5,
    });
    assert.ok(w.recommended_min_gross_per_mile > w.all_in_cost_per_mile);
  });
});
