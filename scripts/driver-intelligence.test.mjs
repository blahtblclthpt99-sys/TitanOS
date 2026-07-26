import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyRushWindow,
  sessionToTrip,
  rateTripWorth,
  summarizeTrips,
  weeklyByWeekday,
  weekdayWeekendCompare,
  buildCoachInsights,
  DEFAULT_RUSH_WINDOWS,
} from "../src/lib/driverActivity/intelligence.js";

describe("Driver Intelligence", () => {
  it("classifies rush windows including overnight wrap", () => {
    const breakfast = classifyRushWindow(new Date("2026-07-25T07:30:00"));
    assert.equal(breakfast.id, "breakfast");
    const overnight = classifyRushWindow(new Date("2026-07-25T02:00:00"));
    assert.equal(overnight.id, "overnight");
    assert.equal(DEFAULT_RUSH_WINDOWS.length, 6);
  });

  it("normalizes a session into a trip with metrics", () => {
    const trip = sessionToTrip({
      id: "s1",
      started_at: "2026-07-25T18:00:00.000Z",
      ended_at: "2026-07-25T20:00:00.000Z",
      miles: 42,
      drive_sec: 5400,
      idle_sec: 1800,
      earnings_gross: 95,
      tips: 12,
      stops_detail: [
        { id: "a", started_at: "2026-07-25T18:20:00.000Z", lat: 1, lng: 2, label: "Pickup" },
        { id: "b", started_at: "2026-07-25T19:40:00.000Z", lat: 3, lng: 4, label: "Drop" },
      ],
      apps: ["DoorDash"],
    });
    assert.equal(trip.id, "s1");
    assert.equal(trip.miles, 42);
    assert.equal(trip.earnings, 95);
    assert.ok(trip.fuel_cost > 0);
    assert.ok(trip.dollars_per_hour > 0);
    assert.equal(trip.platform, "DoorDash");
    assert.ok(trip.rush_id);
  });

  it("rates trip worth with stars", () => {
    const great = rateTripWorth({ earnings: 18, miles: 3, drive_minutes: 15 });
    assert.ok(great.stars >= 4);
    const bad = rateTripWorth({ earnings: 4, miles: 18, drive_minutes: 45 });
    assert.ok(bad.stars <= 2);
  });

  it("builds weekly and weekday/weekend summaries", () => {
    const trips = [
      sessionToTrip({
        id: "a",
        started_at: "2026-07-20T18:00:00", // Monday local-ish ISO without Z uses local
        ended_at: "2026-07-20T20:00:00",
        miles: 30,
        drive_sec: 4000,
        earnings_gross: 80,
      }),
      sessionToTrip({
        id: "b",
        started_at: "2026-07-25T18:00:00", // Saturday
        ended_at: "2026-07-25T21:00:00",
        miles: 40,
        drive_sec: 5000,
        earnings_gross: 120,
      }),
    ].filter(Boolean);
    const weekly = weeklyByWeekday(trips);
    assert.equal(weekly.days.length, 7);
    const ww = weekdayWeekendCompare(trips);
    assert.ok(ww.recommendation);
    const sum = summarizeTrips(trips);
    assert.equal(sum.trips, 2);
    assert.ok(sum.miles >= 70);
  });

  it("returns coach insights", () => {
    const tips = buildCoachInsights([]);
    assert.ok(tips.length >= 1);
    assert.ok(tips.some((t) => /Auto GPS|all-in|floor|vehicle|autopilot/i.test(t.text)));
  });
});
