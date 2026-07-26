import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatOfferCoachCard,
  composeSmartCoachTip,
  buildCoachMoneySnapshot,
} from "../src/lib/driverActivity/driverCoach.js";
import { buildCoachInsights, rateTripWorth } from "../src/lib/driverActivity/intelligence.js";
import { decideOfferSetForget } from "../src/lib/driverActivity/autopilot.js";

describe("Driver money coach responses", () => {
  it("formats ACCEPT glance with $/mi vs need", () => {
    const d = decideOfferSetForget(
      { pay: 20, tip: 5, miles: 3, minutes: 12, parking: 0, deadhead_miles: 0 },
      {
        settings: {
          enabled: true,
          profileId: "balanced",
          useZipAverages: false,
          autoParking: true,
          assumeDeadheadMiles: 0,
          rushAware: false,
          protectHourlyAverage: false,
        },
      }
    );
    const card = formatOfferCoachCard(d);
    assert.equal(card.verdict, "ACCEPT");
    assert.match(card.glance, /ACCEPT/);
    assert.ok(card.headline.length > 8);
  });

  it("formats DENY when under true-cost floor", () => {
    const d = decideOfferSetForget(
      { pay: 4, tip: 0, miles: 14, minutes: 30, parking: 0, deadhead_miles: 0 },
      {
        settings: {
          enabled: true,
          profileId: "chill",
          useZipAverages: false,
          autoParking: true,
          assumeDeadheadMiles: 0,
          rushAware: false,
          protectHourlyAverage: false,
        },
        economics: {
          purchase_price: 25000,
          vehicle_life_miles: 150000,
          tire_set_cost: 700,
          tire_life_miles: 40000,
          maintenance_cents_per_mile: 12,
        },
      }
    );
    const card = formatOfferCoachCard(d);
    assert.equal(card.verdict, "DENY");
    assert.equal(card.tone, "bad");
    assert.match(card.headline, /Skip|floor|under/i);
  });

  it("composeSmartCoachTip includes all-in floor", () => {
    const tip = composeSmartCoachTip({
      mode: "driving",
      dayPart: "dinner",
      mpg: 22,
      gasUsd: 3.5,
      economics: {
        purchase_price: 18000,
        tire_set_cost: 600,
        maintenance_cents_per_mile: 11.5,
      },
    });
    assert.ok(tip.need_per_mile > 0.2);
    assert.match(tip.full, /all-in|floor|\$/i);
  });

  it("buildCoachMoneySnapshot warns when vehicle not configured", () => {
    const snap = buildCoachMoneySnapshot({
      mpg: 22,
      gasUsd: 3.5,
      economics: { purchase_price: 0, tire_set_cost: 0 },
    });
    assert.equal(snap.configured, false);
    assert.match(snap.tip, /vehicle|tire/i);
  });

  it("buildCoachInsights includes true-cost floor insight", () => {
    const tips = buildCoachInsights([], {
      economics: {
        purchase_price: 20000,
        tire_set_cost: 600,
        maintenance_cents_per_mile: 11,
      },
      mpg: 25,
      gasUsd: 3.5,
    });
    assert.ok(tips.length >= 2);
    assert.ok(tips.some((t) => /all-in|floor|vehicle/i.test(t.text)));
  });

  it("rateTripWorth uses true-cost floor for weak payouts", () => {
    const weak = rateTripWorth({
      earnings: 5,
      miles: 12,
      drive_minutes: 35,
      economics: {
        purchase_price: 22000,
        vehicle_life_miles: 150000,
        tire_set_cost: 700,
        maintenance_cents_per_mile: 12,
      },
    });
    assert.ok(weak.stars <= 2);
    assert.equal(weak.clears_true_cost, false);
    assert.ok(weak.recommended_min_gross_per_mile > 0.3);
  });
});
