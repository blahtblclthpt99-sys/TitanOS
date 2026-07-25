/**
 * Driver Activity Engine unit tests.
 * Run: node --test scripts/driver-activity.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { haversineMeters, metersToMiles, speedMphBetween, round1 } from "../src/lib/driverActivity/geo.js";
import { stepStopDetection, DEFAULT_STOP_CONFIG } from "../src/lib/driverActivity/stopDetection.js";
import { computeActivityStats } from "../src/lib/driverActivity/stats.js";
import { buildMileageCsv } from "../src/lib/driverActivity/export.js";

describe("geo", () => {
  it("computes haversine distance", () => {
    const m = haversineMeters({ lat: 40.0, lng: -74.0 }, { lat: 40.01, lng: -74.0 });
    assert.ok(m > 1000 && m < 1200);
    assert.ok(metersToMiles(1609.344) > 0.99 && metersToMiles(1609.344) < 1.01);
  });

  it("estimates speed between points", () => {
    const a = { lat: 40, lng: -74, ts: 0 };
    const b = { lat: 40.01, lng: -74, ts: 60_000 };
    const mph = speedMphBetween(a, b);
    assert.ok(mph > 20 && mph < 80, `unexpected mph=${mph}`);
  });
});

describe("stop detection", () => {
  it("ignores brief traffic pauses", () => {
    let state = { phase: "moving", stationarySec: 0, origin: null, openStopId: null };
    const origin = { lat: 33.1, lng: -96.7, ts: 0 };
    let prev = origin;
    // 30s still — under traffic grace (45s)
    for (let i = 1; i <= 6; i++) {
      const point = { lat: 33.1, lng: -96.7, ts: i * 5000, speedMph: 0.5 };
      const step = stepStopDetection(state, point, prev, DEFAULT_STOP_CONFIG);
      state = step.state;
      prev = point;
      assert.equal(step.events.some((e) => e.type === "stop_start"), false);
    }
    assert.ok(state.phase === "moving" || state.phase === "potential");
  });

  it("confirms a stop after sustained stillness", () => {
    let state = { phase: "moving", stationarySec: 0, origin: null, openStopId: null };
    let prev = { lat: 33.1, lng: -96.7, ts: 0 };
    let started = false;
    for (let i = 1; i <= 25; i++) {
      const point = { lat: 33.1 + 0.00001, lng: -96.7, ts: i * 5000, speedMph: 0.2 };
      const step = stepStopDetection(state, point, prev, {
        ...DEFAULT_STOP_CONFIG,
        trafficGraceSec: 20,
        confirmStopSec: 60,
      });
      state = step.state;
      if (step.events.some((e) => e.type === "stop_start")) started = true;
      prev = point;
    }
    assert.equal(started, true);
    assert.equal(state.phase, "stopped");
  });

  it("ends stop when vehicle resumes", () => {
    let state = {
      phase: "stopped",
      stationarySec: 120,
      origin: { lat: 33.1, lng: -96.7, ts: 0 },
      openStopId: "auto_1",
    };
    const prev = { lat: 33.1, lng: -96.7, ts: 120_000, speedMph: 0 };
    const moving = { lat: 33.12, lng: -96.7, ts: 130_000, speedMph: 25 };
    const step = stepStopDetection(state, moving, prev, DEFAULT_STOP_CONFIG);
    assert.ok(step.events.some((e) => e.type === "stop_end"));
    assert.equal(step.state.phase, "moving");
  });
});

describe("activity stats", () => {
  it("buckets today / week / month", () => {
    const now = new Date("2026-07-25T15:00:00Z");
    const history = [
      { started_at: "2026-07-25T10:00:00Z", miles: 10, drive_sec: 3600, idle_sec: 600, stops: 2 },
      { started_at: "2026-07-20T10:00:00Z", miles: 5, drive_sec: 1800, idle_sec: 300, stops: 1 },
      { started_at: "2026-06-01T10:00:00Z", miles: 20, drive_sec: 7200, idle_sec: 0, stops: 4 },
    ];
    const s = computeActivityStats(history, null, now);
    assert.equal(s.today.miles, 10);
    assert.ok(s.week.miles >= 10);
    assert.ok(s.month.miles >= 15);
    assert.equal(round1(s.all.miles), 35);
    assert.ok(s.today.deductibleEstimateUsd > 0);
  });
});

describe("mileage csv export", () => {
  it("includes header and deductible estimate", () => {
    const csv = buildMileageCsv([
      {
        started_at: "2026-07-25T10:00:00Z",
        ended_at: "2026-07-25T12:00:00Z",
        miles: 12.5,
        drive_sec: 5000,
        idle_sec: 800,
        stops: 3,
      },
    ]);
    assert.match(csv, /deductible_estimate_usd/);
    assert.match(csv, /12\.5/);
    assert.match(csv, /avg_drive_between_stops_sec/);
  });
});

describe("time between stops", () => {
  it("computes drive and miles between stops with running totals", async () => {
    const { buildStopLegReport } = await import("../src/lib/driverActivity/betweenStops.js");
    const session = {
      started_at: "2026-07-25T09:00:00Z",
      ended_at: "2026-07-25T11:00:00Z",
      miles: 40,
      drive_sec: 5400,
      idle_sec: 900,
      active: false,
    };
    const stops = [
      {
        id: "s2",
        started_at: "2026-07-25T10:15:00Z",
        ended_at: "2026-07-25T10:18:00Z",
        duration_sec: 180,
        miles_at_arrival: 35.8,
        miles_at_departure: 35.8,
        drive_sec_at_arrival: 4500,
        drive_sec_at_departure: 4500,
        drive_since_prev_sec: 1620,
        miles_since_prev: 21.6,
      },
      {
        id: "s1",
        started_at: "2026-07-25T09:42:00Z",
        ended_at: "2026-07-25T09:48:00Z",
        duration_sec: 360,
        miles_at_arrival: 14.2,
        miles_at_departure: 14.2,
        drive_sec_at_arrival: 1080,
        drive_sec_at_departure: 1080,
        drive_since_prev_sec: 1080,
        miles_since_prev: 14.2,
      },
    ];
    const report = buildStopLegReport(session, stops);
    assert.equal(report.stops.length, 2);
    assert.equal(report.stops[0].stopNumber, 1);
    assert.equal(report.stops[0].drive_since_prev_sec, 1080);
    assert.equal(report.stops[0].miles_since_prev, 14.2);
    assert.equal(report.stops[0].duration_sec, 360);
    assert.equal(report.stops[1].drive_since_prev_sec, 1620);
    assert.equal(report.stops[1].miles_since_prev, 21.6);
    assert.equal(report.summary.totalStops, 2);
    assert.ok(report.summary.avgDriveBetweenStopsSec > 0);
    assert.ok(report.timeline.some((e) => e.type === "session_start"));
    assert.ok(report.timeline.some((e) => e.type === "session_end"));
    assert.ok(report.insights.pctDriving >= 0);
  });

  it("recomputes after mile corrections on stored arrival values", async () => {
    const { buildStopLegReport } = await import("../src/lib/driverActivity/betweenStops.js");
    const session = {
      started_at: "2026-07-25T09:00:00Z",
      ended_at: "2026-07-25T10:00:00Z",
      miles: 20,
      drive_sec: 2400,
      active: false,
    };
    const stops = [
      {
        id: "a",
        started_at: "2026-07-25T09:30:00Z",
        ended_at: "2026-07-25T09:35:00Z",
        duration_sec: 300,
        miles_at_arrival: 12,
        miles_at_departure: 12,
        drive_sec_at_arrival: 1200,
        drive_sec_at_departure: 1200,
        drive_since_prev_sec: 1200,
        miles_since_prev: 12,
      },
    ];
    const before = buildStopLegReport(session, stops);
    assert.equal(before.stops[0].miles_since_prev, 12);
    const corrected = buildStopLegReport(
      { ...session, miles: 22 },
      [{ ...stops[0], miles_at_arrival: 15, miles_since_prev: 15, miles_at_departure: 15 }]
    );
    assert.equal(corrected.stops[0].miles_since_prev, 15);
    assert.equal(corrected.summary.totalBusinessMiles, 22);
  });

  it("tolerates non-array stops payloads without throwing", async () => {
    const { buildStopLegReport, summarizeBetweenStopsDaily } = await import(
      "../src/lib/driverActivity/betweenStops.js"
    );
    const session = {
      started_at: "2026-07-25T09:00:00Z",
      active: true,
      miles: 3,
      drive_sec: 100,
    };
    const fromObject = buildStopLegReport(session, {
      a: { id: "a", started_at: "2026-07-25T09:10:00Z", ended_at: "2026-07-25T09:12:00Z" },
    });
    assert.equal(fromObject.summary.totalStops, 1);
    const fromNull = buildStopLegReport(session, null);
    assert.equal(fromNull.summary.totalStops, 0);
    const daily = summarizeBetweenStopsDaily([
      { ...session, ended_at: "2026-07-25T10:00:00Z", stops_detail: { x: 1 } },
    ]);
    assert.equal(typeof daily.totalStops, "number");
  });
});
