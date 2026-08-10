import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseOfferQuickText,
  buildSpectrumScores,
  decideOfferSetForget,
  getAutopilotProfile,
  resolveAutopilotThresholds,
  logAutopilotDecision,
  recordAutopilotAction,
  listAutopilotActions,
  AUTOPILOT_PROFILES,
} from "../src/lib/driverActivity/autopilot.js";
import {
  acceptDenyMileStats,
  ultimateWorthPerMile,
} from "../src/lib/driverActivity/trueCostPerMile.js";
import { buildZipBenchmarks } from "../src/lib/driverActivity/zipBenchmarks.js";

describe("Set-&-forget autopilot", () => {
  it("exposes chill / balanced / strict profiles", () => {
    assert.ok(AUTOPILOT_PROFILES.chill);
    assert.ok(AUTOPILOT_PROFILES.balanced);
    assert.ok(AUTOPILOT_PROFILES.strict);
    assert.ok(getAutopilotProfile("strict").patch.minHourlyAccept > getAutopilotProfile("chill").patch.minHourlyAccept);
  });

  it("parses paste and slash offer text", () => {
    const a = parseOfferQuickText("$14.50 4.2mi 18min 75201");
    assert.equal(a.pay, 14.5);
    assert.equal(a.miles, 4.2);
    assert.equal(a.minutes, 18);
    assert.equal(a.zip, "75201");
    const b = parseOfferQuickText("12 / 5 / 20");
    assert.equal(b.pay, 12);
    assert.equal(b.miles, 5);
    assert.equal(b.minutes, 20);
  });

  it("builds spectrum scores 0–100", () => {
    const decision = decideOfferSetForget(
      { pay: 18, tip: 5, miles: 3, minutes: 15, parking: 0, deadhead_miles: 0.5 },
      {
        settings: {
          enabled: true,
          profileId: "balanced",
          useZipAverages: false,
          autoParking: true,
          assumeDeadheadMiles: 1,
          defaultStackCount: 1,
          rushAware: false,
        },
      }
    );
    assert.ok(decision.spectrum.overall >= 0 && decision.spectrum.overall <= 100);
    assert.ok("hourly" in decision.spectrum);
    assert.ok("true_cost" in decision.spectrum);
    assert.ok("zip" in decision.spectrum);
    assert.ok("rush" in decision.spectrum);
  });

  it("never ACCEPTs when true-cost floor fails", () => {
    const d = decideOfferSetForget(
      { pay: 5, tip: 0, miles: 12, minutes: 20, parking: 0, deadhead_miles: 0 },
      {
        settings: {
          enabled: true,
          profileId: "chill",
          useZipAverages: false,
          autoParking: true,
          assumeDeadheadMiles: 0,
          defaultStackCount: 1,
          rushAware: false,
          protectHourlyAverage: false,
        },
        economics: {
          purchase_price: 28000,
          vehicle_life_miles: 120000,
          tire_set_cost: 800,
          tire_life_miles: 35000,
          tire_miles_used: 0,
          maintenance_cents_per_mile: 12,
        },
      }
    );
    assert.equal(d.gates.trueCost, false);
    assert.equal(d.verdict, "DENY");
    assert.match(d.action, /all-in|floor|Skip/i);
  });

  it("ACCEPT a strong offer under balanced set-&-forget", () => {
    const d = decideOfferSetForget(
      {
        pay: 16,
        tip: 8,
        miles: 3,
        minutes: 14,
        stack_count: 1,
        parking: 0,
        deadhead_miles: 0.5,
      },
      {
        settings: {
          enabled: true,
          profileId: "balanced",
          useZipAverages: false,
          autoParking: true,
          assumeDeadheadMiles: 0.5,
          defaultStackCount: 1,
          rushAware: false,
          protectHourlyAverage: false,
        },
      }
    );
    assert.equal(d.verdict, "ACCEPT");
    assert.equal(d.moneyFirst, true);
    assert.ok(d.money);
    assert.ok(d.minimum_offer_pay > 0);
  });

  it("DENY weak offers under strict profile", () => {
    const d = decideOfferSetForget(
      { pay: 6, tip: 0, miles: 8, minutes: 28, parking: 3, deadhead_miles: 2 },
      {
        settings: {
          enabled: true,
          profileId: "strict",
          useZipAverages: false,
          autoParking: true,
          assumeDeadheadMiles: 2,
          defaultStackCount: 1,
          rushAware: false,
          protectHourlyAverage: true,
        },
      }
    );
    assert.equal(d.verdict, "DENY");
  });

  it("protects $/hr average when offer is below ZIP baseline", () => {
    const benchmarks = buildZipBenchmarks({
      journal: [
        { id: "1", zip: "75201", earnings: 22, tips: 4, miles: 4, drive_sec: 1200 },
        { id: "2", zip: "75201", earnings: 20, tips: 3, miles: 3.5, drive_sec: 1100 },
        { id: "3", zip: "75201", earnings: 24, tips: 5, miles: 4.5, drive_sec: 1300 },
      ],
    });
    const d = decideOfferSetForget(
      { pay: 9, tip: 1, miles: 4, minutes: 22, zip: "75201", deadhead_miles: 0, parking: 0 },
      {
        settings: {
          enabled: true,
          profileId: "chill",
          useZipAverages: true,
          autoParking: true,
          assumeDeadheadMiles: 0,
          defaultStackCount: 1,
          rushAware: false,
          protectHourlyAverage: true,
        },
        benchmarks,
      }
    );
    assert.equal(d.verdict, "DENY");
    assert.ok(d.money.delta_per_hour < 0);
    assert.match(d.action, /Skip|Protect|average|bag/i);
  });

  it("fills deadhead + parking defaults when omitted", () => {
    const d = decideOfferSetForget(
      { pay: 20, tip: 0, miles: 4, minutes: 18 },
      {
        settings: {
          enabled: true,
          profileId: "balanced",
          useZipAverages: false,
          autoParking: true,
          assumeDeadheadMiles: 2,
          defaultStackCount: 1,
          rushAware: false,
        },
        thresholds: resolveAutopilotThresholds(null, { profileId: "balanced" }),
      }
    );
    assert.equal(d.filled.deadhead_miles, 2);
    assert.equal(d.filled.parking, 0);
  });

  it("uses ZIP averages when enabled", () => {
    const benchmarks = buildZipBenchmarks({
      journal: [
        { id: "1", zip: "75201", earnings: 22, tips: 4, miles: 4, drive_sec: 1200 },
        { id: "2", zip: "75201", earnings: 20, tips: 3, miles: 3.5, drive_sec: 1100 },
        { id: "3", zip: "75201", earnings: 24, tips: 5, miles: 4.5, drive_sec: 1300 },
      ],
    });
    const d = decideOfferSetForget(
      { pay: 7, tip: 0, miles: 4, minutes: 20, zip: "75201", deadhead_miles: 0, parking: 0 },
      {
        settings: {
          enabled: true,
          profileId: "balanced",
          useZipAverages: true,
          autoParking: true,
          assumeDeadheadMiles: 0,
          defaultStackCount: 1,
          rushAware: false,
        },
        benchmarks,
      }
    );
    assert.equal(d.verdict, "DENY");
    assert.equal(d.gates.zipBeat, false);
  });

  it("spectrum helper clamps scores", () => {
    const s = buildSpectrumScores({
      breakdown: { hourlyNet: 40, netProfit: 10, perMileNet: 2, stackCount: 1, parking: 0, gross: 20, costs: 2 },
      thresholds: { minHourlyAccept: 18, minProfitAccept: 2.5, minPerMileAccept: 0.85 },
      gates: { zipBeat: true },
      zipBenchmark: { trips: 5 },
    });
    assert.ok(s.overall <= 100);
    assert.ok(s.hourly >= 70);
  });

  it("learns minimums only from the driver's real actions", () => {
    const userId = `adaptive-${Date.now()}`;
    const decision = {
      verdict: "ACCEPT",
      spectrum: { overall: 82 },
      money: { delta_per_hour: 5 },
      breakdown: {
        gross: 12,
        totalMiles: 6,
        perMileGross: 2,
        perMileNet: 1.4,
        hourlyNet: 24,
      },
      filled: { pay: 12, tip: 0, miles: 6, minutes: 30 },
      profileId: "balanced",
    };

    logAutopilotDecision(userId, decision, decision.filled);
    assert.equal(acceptDenyMileStats(userId).accepted_count, 0);

    for (const pay of [12, 13.2, 14.4]) {
      const perMile = pay / 6;
      recordAutopilotAction(
        userId,
        {
          ...decision,
          breakdown: {
            ...decision.breakdown,
            gross: pay,
            perMileGross: perMile,
            hourlyNet: pay * 2,
          },
        },
        { ...decision.filled, pay },
        "ACCEPT"
      );
    }

    const learned = acceptDenyMileStats(userId);
    assert.equal(learned.accepted_count, 3);
    assert.ok(learned.personal_floor_per_mile >= 2);
    assert.ok(learned.personal_floor_per_hour >= 24);
    assert.equal(listAutopilotActions(userId, 10).length, 3);
    const thresholds = resolveAutopilotThresholds(userId, { profileId: "chill" });
    assert.ok(thresholds.minHourlyAccept >= learned.personal_floor_per_hour);
    const worth = ultimateWorthPerMile({ userId, mpg: 24, gasUsd: 3.5, totalMiles: 5 });
    assert.ok(worth.recommended_min_gross_per_mile >= learned.personal_floor_per_mile);
  });
});
