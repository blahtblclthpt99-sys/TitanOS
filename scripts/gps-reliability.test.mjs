import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createBrowserTracker } from "../src/lib/driverActivity/tracker.js";

function installFakeGps() {
  let success;
  const geolocation = {
    watchPosition(onSuccess) { success = onSuccess; return 91; },
    clearWatch() {},
  };
  Object.defineProperty(globalThis.navigator, "geolocation", { configurable: true, value: geolocation });
  return (latitude, longitude, timestamp, speed = 0) => success({ coords: { latitude, longitude, accuracy: 5, speed }, timestamp });
}

test("GPS distance retains short valid segments instead of rounding them away", () => {
  const push = installFakeGps();
  const tracker = createBrowserTracker();
  tracker.start();
  const started = Date.now();
  for (let index = 0; index <= 20; index += 1) push(41 + index * 0.00012, -87, started + index * 1000, 12);
  const snapshot = tracker.getSnapshot();
  tracker.stop();
  assert.ok(snapshot.miles > 0.1, `expected accumulated distance, received ${snapshot.miles}`);
});

test("idle timer advances from wall clock when GPS stops emitting fixes", async () => {
  const push = installFakeGps();
  const tracker = createBrowserTracker();
  tracker.start();
  push(41, -87, Date.now(), 0);
  await new Promise((resolve) => setTimeout(resolve, 1150));
  const snapshot = tracker.getSnapshot();
  tracker.stop();
  assert.ok(snapshot.idleSec >= 1, `expected idle heartbeat, received ${snapshot.idleSec}`);
});

test("Android declares runtime GPS permissions", async () => {
  const manifest = await readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");
  assert.match(manifest, /ACCESS_COARSE_LOCATION/);
  assert.match(manifest, /ACCESS_FINE_LOCATION/);
  assert.match(manifest, /hardware\.location\.gps/);
});

test("ending a shift subtracts accumulated and active pause time", async () => {
  const source = await readFile(new URL("../src/lib/driverHubApi.js", import.meta.url), "utf8");
  assert.match(source, /pause_accum_sec/);
  assert.match(source, /pausedNowSec/);
  assert.match(source, /\) - pauseSec/);
});
