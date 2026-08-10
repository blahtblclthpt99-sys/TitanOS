import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseDriverCsv,
  parseDriverJson,
  parseDriverText,
  summarizeDriverPerformance,
} from "../src/lib/driverActivity/recordImport.js";
import { percentileLabel } from "../src/lib/driverActivity/performanceBenchmark.js";

describe("rideshare and delivery record imports", () => {
  it("hides percentile language until the private cohort is large enough", () => {
    assert.equal(percentileLabel(null), null);
    assert.equal(percentileLabel(undefined), null);
    assert.equal(percentileLabel(""), null);
    assert.equal(percentileLabel(82), "Top 25%");
  });

  it("normalizes an Uber-style CSV without double-counting tips", () => {
    const rows = parseDriverCsv(
      "Trip Date,Net Earnings,Tips,Trip Distance,Trip Duration\n2026-08-01,$24.50,$5.00,12.5 mi,01:10:00",
      { fileName: "uber-payment-statement.csv" }
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].platform, "uber");
    assert.equal(rows[0].gross, 24.5);
    assert.equal(rows[0].tips, 5);
    assert.equal(rows[0].miles, 12.5);
    assert.equal(rows[0].active_sec, 4200);
  });

  it("combines DoorDash base pay, tips, and peak pay when no total exists", () => {
    const rows = parseDriverCsv(
      "Delivery Date,Base Pay,Customer Tip,Peak Pay,Active Minutes,Dash Time (minutes),Miles\n2026-08-02,8.25,4.00,2.00,31,48,7.2",
      { fileName: "dasher-history.csv" }
    );
    assert.equal(rows[0].platform, "doordash");
    assert.equal(rows[0].gross, 14.25);
    assert.equal(rows[0].active_sec, 1860);
    assert.equal(rows[0].online_sec, 2880);
  });

  it("reads nested JSON exports and text/PDF-style summaries", () => {
    const json = parseDriverJson(JSON.stringify({ trips: [{ date: "2026-08-03", platform: "Lyft", earnings: 30, miles: 15, activeHours: 1.5 }] }), { fileName: "history.json" });
    assert.equal(json[0].platform, "lyft");
    const text = parseDriverText("DoorDash monthly statement Total earnings: $420.25 Total miles: 210 Active time: 18 hours Dash time: 25 hours Deliveries: 42", { fileName: "statement.pdf" });
    assert.equal(text[0].gross, 420.25);
    assert.equal(text[0].trip_count, 42);
    assert.equal(text[0].online_sec, 90000);
  });

  it("produces a bounded score and per-platform comparison", () => {
    const summary = summarizeDriverPerformance([
      { platform: "uber", gross: 100, miles: 50, active_sec: 4 * 3600, online_sec: 5 * 3600, trip_count: 8 },
      { platform: "doordash", gross: 90, miles: 35, active_sec: 3 * 3600, online_sec: 4 * 3600, trip_count: 10 },
    ], { costPerMile: 0.4 });
    assert.ok(summary.score >= 0 && summary.score <= 100);
    assert.equal(summary.trips, 18);
    assert.equal(summary.platforms.length, 2);
    assert.equal(summary.profit, 156);
    assert.equal(summary.utilization, 78);
  });
});
