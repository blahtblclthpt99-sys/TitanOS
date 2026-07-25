/**
 * Vehicle capacity validation, fit estimates, and job matching.
 * Run: node --test scripts/vehicle-capacity.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  capacityToLegacyVehicleFields,
  computeVolumeCuFt,
  emptyVehicleCapacity,
  estimateWhatFits,
  hasCapacityData,
  normalizeVehicleCapacity,
  recommendJobTypes,
  validateVehicleCapacity,
} from "../src/lib/vehicleCapacity.js";

describe("validateVehicleCapacity", () => {
  it("rejects negative dimensions", () => {
    const { ok, errors } = validateVehicleCapacity({
      dimensions: { cargoLengthIn: -1, cargoWidthIn: 40, cargoHeightIn: 40 },
    });
    assert.equal(ok, false);
    assert.ok(errors.some((e) => /negative/i.test(e)));
  });

  it("rejects recommended payload above max", () => {
    const { ok, errors } = validateVehicleCapacity({
      weight: { maxPayloadLb: 1000, recommendedWorkingPayloadLb: 1500 },
    });
    assert.equal(ok, false);
    assert.ok(errors.some((e) => /recommended working payload/i.test(e)));
  });

  it("accepts a normal van profile", () => {
    const { ok, value } = validateVehicleCapacity({
      identity: { vehicleType: "Cargo Van", make: "Ford", model: "Transit", year: 2019, seats: 2 },
      dimensions: { cargoLengthIn: 120, cargoWidthIn: 55, cargoHeightIn: 55 },
      weight: { maxPayloadLb: 3500, recommendedWorkingPayloadLb: 2800 },
    });
    assert.equal(ok, true);
    assert.ok(value.dimensions.cargoVolumeCuFt > 0);
  });
});

describe("computeVolumeCuFt", () => {
  it("computes L×W×H / 1728", () => {
    assert.equal(computeVolumeCuFt({ cargoLengthIn: 12, cargoWidthIn: 12, cargoHeightIn: 12 }), 1);
  });
});

describe("estimateWhatFits", () => {
  it("needs full dimensions", () => {
    const r = estimateWhatFits(emptyVehicleCapacity());
    assert.equal(r.ready, false);
  });

  it("marks moving boxes as fit for a van", () => {
    const r = estimateWhatFits({
      dimensions: { cargoLengthIn: 120, cargoWidthIn: 55, cargoHeightIn: 60 },
      weight: { recommendedWorkingPayloadLb: 2000 },
    });
    assert.equal(r.ready, true);
    assert.ok(r.fits.some((i) => i.id === "moving_boxes"));
    assert.ok(r.fits.every((i) => i.estimate === true));
  });

  it("flags motorcycle when under payload", () => {
    const r = estimateWhatFits({
      dimensions: { cargoLengthIn: 120, cargoWidthIn: 55, cargoHeightIn: 60 },
      weight: { recommendedWorkingPayloadLb: 200 },
    });
    assert.ok(r.mayFit.some((i) => i.id === "motorcycle") || r.doesNotFit.some((i) => i.id === "motorcycle"));
  });
});

describe("recommendJobTypes", () => {
  it("does not recommend local moving for tiny payload", () => {
    const r = recommendJobTypes({
      weight: { maxPayloadLb: 100 },
      dimensions: { cargoLengthIn: 40, cargoWidthIn: 30, cargoHeightIn: 30, cargoVolumeCuFt: 20 },
    });
    assert.equal(r.ready, true);
    assert.ok(!r.suitable.some((j) => j.id === "local_moving" && !j.caution));
    assert.ok(r.unsuitable.some((j) => j.id === "local_moving") || !r.suitable.some((j) => j.id === "local_moving"));
  });

  it("suggests courier for light vans", () => {
    const r = recommendJobTypes({
      weight: { recommendedWorkingPayloadLb: 800 },
      dimensions: { cargoLengthIn: 80, cargoWidthIn: 48, cargoHeightIn: 48, cargoVolumeCuFt: 100 },
    });
    assert.ok(r.suitable.some((j) => j.id === "courier" || j.id === "small_delivery"));
  });
});

describe("legacy sync + normalize", () => {
  it("maps capacity to directory columns", () => {
    const legacy = capacityToLegacyVehicleFields({
      identity: { vehicleType: "Pickup", year: 2020, make: "Toyota", model: "Tacoma" },
      dimensions: { bedLengthIn: 72 },
      weight: { maxPayloadLb: 1500 },
    });
    assert.equal(legacy.vehicleType, "Pickup");
    assert.equal(legacy.vehicleMake, "Toyota");
    assert.equal(legacy.vehicleCapacityLbs, 1500);
    assert.equal(legacy.vehicleLengthFt, 6);
  });

  it("hasCapacityData detects empty vs filled", () => {
    assert.equal(hasCapacityData(emptyVehicleCapacity()), false);
    assert.equal(
      hasCapacityData(normalizeVehicleCapacity({ weight: { maxPayloadLb: 500 } })),
      true
    );
  });
});
