import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { activeGpsOwner, isDoorDashGpsActive } from "../src/lib/driverActivity/gpsOwner.js";
import {
  createDelivery,
  DD_PREFIX,
  DD_ACTIVE_SUFFIX,
} from "../src/lib/driverActivity/doorDashWorkflow.js";
import { writeLocal } from "../src/lib/localStore.js";

const USER = "gps-sim-user";

beforeEach(() => {
  localStorage.clear();
});

describe("GPS owner simulation", () => {
  it("defaults to session when no active DoorDash delivery", () => {
    assert.equal(activeGpsOwner(USER), "session");
    assert.equal(isDoorDashGpsActive(USER), false);
  });

  it("DoorDash active delivery claims GNSS ownership", () => {
    const delivery = createDelivery({
      orderTypeId: "single",
      gps: { lat: 41.88, lng: -87.63 },
      now: Date.now(),
    });
    assert.equal(delivery.status, "active");
    writeLocal(DD_PREFIX, USER, DD_ACTIVE_SUFFIX, delivery);
    assert.equal(activeGpsOwner(USER), "doordash");
    assert.equal(isDoorDashGpsActive(USER), true);
  });

  it("returns null without userId", () => {
    assert.equal(activeGpsOwner(null), null);
  });

  it("completed delivery yields GPS back to session", () => {
    writeLocal(DD_PREFIX, USER, DD_ACTIVE_SUFFIX, {
      id: "x",
      status: "completed",
    });
    assert.equal(activeGpsOwner(USER), "session");
  });
});
