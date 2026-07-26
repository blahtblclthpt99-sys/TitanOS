import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeOffer,
  normalizeOfferInput,
  resolveEffectiveThresholds,
} from "../src/lib/driverActivity/offerAnalyzer.js";
import {
  buildZipBenchmarks,
  getZipBenchmark,
  normalizeZip,
} from "../src/lib/driverActivity/zipBenchmarks.js";

describe("Offer analyzer", () => {
  it("adds stack extras for double orders from different places", () => {
    const n = normalizeOfferInput({
      pay: 12,
      tip: 4,
      miles: 5,
      minutes: 20,
      stack_count: 2,
      same_restaurant: false,
    });
    assert.equal(n.stackCount, 2);
    assert.ok(n.extraMiles >= 1.5);
    assert.ok(n.extraMin >= 8);
    assert.ok(n.totalMiles > 5);
  });

  it("uses lighter extras for same-restaurant stacks", () => {
    const same = normalizeOfferInput({
      miles: 5,
      minutes: 20,
      stack_count: 2,
      same_restaurant: true,
    });
    const diff = normalizeOfferInput({
      miles: 5,
      minutes: 20,
      stack_count: 2,
      same_restaurant: false,
    });
    assert.ok(same.extraMiles < diff.extraMiles);
    assert.ok(same.extraMin < diff.extraMin);
  });

  it("DENY when parking and miles destroy profit", () => {
    const r = analyzeOffer({
      pay: 4,
      tip: 0,
      miles: 12,
      minutes: 35,
      parking: 8,
      deadhead_miles: 4,
      stack_count: 1,
    });
    assert.equal(r.verdict, "DENY");
    assert.ok(r.breakdown.costs > r.breakdown.gross);
  });

  it("ACCEPT a strong short stack with tip", () => {
    const r = analyzeOffer({
      pay: 10,
      tip: 8,
      miles: 3,
      minutes: 18,
      parking: 0,
      deadhead_miles: 0.5,
      stack_count: 2,
      same_restaurant: true,
    });
    assert.equal(r.verdict, "ACCEPT");
    assert.ok(r.breakdown.netProfit > 0);
    assert.ok(r.breakdown.hourlyNet >= 18);
  });

  it("subtracts parking from net", () => {
    const noPark = analyzeOffer({ pay: 15, tip: 0, miles: 4, minutes: 20, parking: 0 });
    const park = analyzeOffer({ pay: 15, tip: 0, miles: 4, minutes: 20, parking: 5 });
    assert.ok(park.breakdown.netProfit < noPark.breakdown.netProfit);
    assert.equal(Math.round((noPark.breakdown.netProfit - park.breakdown.netProfit) * 100) / 100, 5);
  });

  it("DENY when offer is under strong ZIP average even if base floors pass", () => {
    const benchmarks = buildZipBenchmarks({
      journal: [
        { id: "a", zip: "75201", earnings: 20, tips: 5, miles: 4, drive_sec: 1200 },
        { id: "b", zip: "75201", earnings: 18, tips: 4, miles: 3.5, drive_sec: 1100 },
        { id: "c", zip: "75201", earnings: 22, tips: 6, miles: 4.2, drive_sec: 1300 },
      ],
    });
    // Weak offer vs ~$5+/mi ZIP average
    const r = analyzeOffer(
      {
        pay: 6,
        tip: 1,
        miles: 4,
        minutes: 20,
        deadhead_miles: 0,
        parking: 0,
        zip: "75201",
      },
      { minHourlyAccept: 10, minProfitAccept: 1, minPerMileAccept: 0.5, zipMinSamples: 2 },
      { benchmarks }
    );
    assert.equal(r.verdict, "DENY");
    assert.equal(r.gates.zipBeat, false);
    assert.ok(r.zipBenchmark?.avg_per_mile > 4);
  });
});

describe("ZIP benchmarks", () => {
  it("normalizes ZIP codes", () => {
    assert.equal(normalizeZip("75201-1234"), "75201");
    assert.equal(normalizeZip(" 75201 "), "75201");
  });

  it("averages pay by ZIP from journal", () => {
    const b = buildZipBenchmarks({
      journal: [
        { id: "1", zip: "75201", earnings: 10, tips: 2, miles: 4, drive_sec: 1800 },
        { id: "2", zip: "75201", earnings: 14, tips: 0, miles: 6, drive_sec: 2400 },
        { id: "3", zip: "75001", earnings: 8, tips: 0, miles: 10, drive_sec: 3600 },
      ],
    });
    assert.equal(b.byZip["75201"].trips, 2);
    assert.equal(b.byZip["75201"].avg_pay, 13);
    assert.equal(b.byZip["75201"].avg_per_mile, 2.6);
    assert.ok(b.ranked[0].zip === "75201");
  });

  it("falls back to overall when ZIP unknown", () => {
    const b = buildZipBenchmarks({
      journal: [{ id: "1", zip: "75201", earnings: 12, tips: 0, miles: 4, drive_sec: 1200 }],
    });
    const hit = getZipBenchmark(b, "99999");
    assert.equal(hit.source, "overall");
    assert.ok(hit.trips >= 1);
  });

  it("raises floors from ZIP average", () => {
    const bench = { trips: 5, avg_per_hour: 30, avg_per_mile: 2.5 };
    const t = resolveEffectiveThresholds(
      { minHourlyAccept: 18, minPerMileAccept: 0.85, zipFloorFactor: 0.9, zipMinSamples: 2 },
      bench
    );
    assert.equal(t.minHourlyAccept, 27);
    assert.equal(t.minPerMileAccept, 2.25);
    assert.equal(t.calibratedFromZip, true);
  });
});
