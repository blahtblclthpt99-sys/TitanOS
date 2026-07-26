import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  acceptNewOrder,
  arriveAtCustomer,
  arriveAtRestaurant,
  cancelDelivery,
  completeDelivery,
  createDelivery,
  DD_DEPART_HOLD_SEC,
  DD_DEPART_SPEED_MPH,
  DD_SCREENS,
  departRestaurant,
  formatTimerHms,
  rejectNewOrder,
  tickRestaurantSpeed,
  timerElapsedMs,
  pauseTimer,
  resumeTimer,
  summarizeDoorDashPerformance,
} from "../src/lib/driverActivity/doorDashWorkflow.js";

const GPS = { lat: 41.88, lng: -87.63 };

describe("DoorDash workflow", () => {
  it("starts single order with primary timer and screen 2", () => {
    const t0 = 1_000_000;
    const d = createDelivery({ orderTypeId: "single", gps: GPS, now: t0 });
    assert.equal(d.screen, DD_SCREENS.TO_RESTAURANT);
    assert.equal(d.platform, "DoorDash");
    assert.equal(d.orderTypeId, "single");
    assert.equal(d.activeOrderCount, 1);
    assert.equal(d.milesTracking, true);
    assert.ok(d.primaryTimer.runningSince === t0);
    assert.match(formatTimerHms(d.primaryTimer, t0 + 7000), /00:00:07/);
  });

  it("arrive restaurant pauses primary and starts secondary", () => {
    const t0 = 2_000_000;
    let d = createDelivery({ orderTypeId: "double", gps: GPS, now: t0 });
    d = arriveAtRestaurant(d, { gps: GPS, now: t0 + 60_000 });
    assert.equal(d.screen, DD_SCREENS.AT_RESTAURANT);
    assert.equal(d.primaryTimer.runningSince, null);
    assert.ok(d.secondaryTimer.runningSince === t0 + 60_000);
    assert.equal(d.milesTracking, false);
    assert.ok(d.arrivalRestaurant);
  });

  it("auto-departs after 15 mph for 10 consecutive seconds", () => {
    const t0 = 3_000_000;
    let d = createDelivery({ orderTypeId: "triple", gps: GPS, now: t0 });
    d = arriveAtRestaurant(d, { gps: GPS, now: t0 + 10_000 });
    let departed = false;
    for (let i = 0; i < DD_DEPART_HOLD_SEC - 1; i++) {
      const r = tickRestaurantSpeed(d, DD_DEPART_SPEED_MPH + 1, 1, {
        gps: GPS,
        now: t0 + 10_000 + (i + 1) * 1000,
      });
      d = r.delivery;
      departed = r.departed;
    }
    assert.equal(departed, false);
    assert.equal(d.screen, DD_SCREENS.AT_RESTAURANT);

    const r = tickRestaurantSpeed(d, DD_DEPART_SPEED_MPH + 5, 1, {
      gps: GPS,
      now: t0 + 10_000 + DD_DEPART_HOLD_SEC * 1000,
    });
    assert.equal(r.departed, true);
    assert.equal(r.delivery.screen, DD_SCREENS.TO_CUSTOMER);
    assert.equal(r.delivery.milesTracking, true);
    assert.ok(r.delivery.primaryTimer.runningSince != null);
    assert.equal(r.delivery.secondaryTimer.runningSince, null);
  });

  it("resets high-speed streak when speed drops", () => {
    const t0 = 4_000_000;
    let d = createDelivery({ orderTypeId: "single", gps: GPS, now: t0 });
    d = arriveAtRestaurant(d, { gps: GPS, now: t0 + 1000 });
    d = tickRestaurantSpeed(d, 20, 5, { now: t0 + 2000 }).delivery;
    assert.equal(d.highSpeedStreakSec, 5);
    d = tickRestaurantSpeed(d, 5, 1, { now: t0 + 3000 }).delivery;
    assert.equal(d.highSpeedStreakSec, 0);
  });

  it("accept / reject add-ons stay on same screen", () => {
    let d = createDelivery({ orderTypeId: "single", gps: GPS, now: 5_000_000 });
    d = acceptNewOrder(d, { gps: GPS });
    d = rejectNewOrder(d, { gps: GPS, reason: "too far" });
    assert.equal(d.screen, DD_SCREENS.TO_RESTAURANT);
    assert.equal(d.acceptedAddons, 1);
    assert.equal(d.rejectedAddons, 1);
    assert.equal(d.activeOrderCount, 2);
  });

  it("full happy path computes analytics", () => {
    const t0 = 6_000_000;
    let d = createDelivery({ orderTypeId: "slow_single", gps: GPS, now: t0 });
    d = { ...d, miles: 2.5 };
    d = arriveAtRestaurant(d, { gps: GPS, now: t0 + 300_000 });
    d = departRestaurant(d, { gps: GPS, now: t0 + 420_000, auto: false });
    d = { ...d, miles: 5.1 };
    d = arriveAtCustomer(d, { gps: GPS, now: t0 + 600_000 });
    d = completeDelivery(d, { gps: GPS, payoutUsd: 12.5, now: t0 + 660_000 });
    assert.equal(d.status, "completed");
    assert.ok(d.analytics);
    assert.equal(d.analytics.platform, "DoorDash");
    assert.equal(d.analytics.totalMiles, 5.1);
    assert.ok(d.analytics.restaurantWaitSec >= 100);
    assert.equal(d.analytics.dollarsPerMile, Math.round((12.5 / 5.1) * 100) / 100);
    assert.ok(d.analytics.totalDurationSec >= 600);
  });

  it("cancel ends delivery with analytics", () => {
    const t0 = 7_000_000;
    let d = createDelivery({ orderTypeId: "single", gps: GPS, now: t0 });
    d = cancelDelivery(d, { gps: GPS, now: t0 + 30_000 });
    assert.equal(d.status, "cancelled");
    assert.equal(d.analytics.status, "cancelled");
    assert.equal(d.analytics.completionRate, 0);
  });

  it("pause/resume timer preserves elapsed", () => {
    const t0 = 8_000_000;
    let timer = { accumulatedMs: 0, runningSince: t0 };
    assert.equal(timerElapsedMs(timer, t0 + 5000), 5000);
    timer = pauseTimer(timer, t0 + 5000);
    assert.equal(timer.runningSince, null);
    assert.equal(timer.accumulatedMs, 5000);
    timer = resumeTimer(timer, t0 + 8000);
    assert.equal(timerElapsedMs(timer, t0 + 10000), 7000);
  });

  it("summarizes performance for start-screen strip", () => {
    const history = [
      {
        status: "completed",
        acceptedAddons: 1,
        rejectedAddons: 0,
        analytics: { restaurantWaitSec: 100, totalMiles: 4, totalDurationSec: 600, acceptedAddons: 1, rejectedAddons: 0 },
      },
      {
        status: "cancelled",
        acceptedAddons: 0,
        rejectedAddons: 1,
        analytics: { restaurantWaitSec: 20, totalMiles: 1, totalDurationSec: 120, acceptedAddons: 0, rejectedAddons: 1 },
      },
      {
        status: "completed",
        acceptedAddons: 0,
        rejectedAddons: 0,
        analytics: { restaurantWaitSec: 200, totalMiles: 6, totalDurationSec: 800, acceptedAddons: 0, rejectedAddons: 0 },
      },
    ];
    const s = summarizeDoorDashPerformance(history);
    assert.equal(s.totalRuns, 3);
    assert.equal(s.completed, 2);
    assert.equal(s.completionRate, 67);
    assert.equal(s.avgRestaurantWaitSec, 150);
    assert.equal(s.avgMiles, 5);
    assert.equal(s.acceptedAddons, 1);
    assert.equal(s.rejectedAddons, 1);
  });
});
