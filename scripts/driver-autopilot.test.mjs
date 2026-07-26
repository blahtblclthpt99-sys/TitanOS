import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseOfferQuickText,
  buildSpectrumScores,
  decideOfferSetForget,
  getAutopilotProfile,
  resolveAutopilotThresholds,
  AUTOPILOT_PROFILES,
} from "../src/lib/driverActivity/autopilot.js";
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
    assert.ok("zip" in decision.spectrum);
    assert.ok("rush" in decision.spectrum);
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
});
