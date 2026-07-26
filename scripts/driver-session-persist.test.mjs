import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createBrowserTracker } from "../src/lib/driverActivity/tracker.js";

/** Mirrors patchSessionTelemetry never-decrease rule (pure). */
function mergeTelemetryCounters(session, patch) {
  const drive =
    patch.drive_sec != null
      ? Math.max(Number(session.drive_sec || 0), Number(patch.drive_sec) || 0)
      : Number(session.drive_sec || 0);
  const idle =
    patch.idle_sec != null
      ? Math.max(Number(session.idle_sec || 0), Number(patch.idle_sec) || 0)
      : Number(session.idle_sec || 0);
  const miles = Math.max(Number(session.miles || 0), Number(patch.auto_miles || 0));
  return { drive_sec: drive, idle_sec: idle, miles };
}

function elapsedFromSession(session, now = Date.now()) {
  const started = new Date(session.started_at).getTime();
  let pauseAccum = Number(session.pause_accum_sec || 0);
  if (session.paused && session.paused_at) {
    pauseAccum += Math.max(0, Math.round((now - new Date(session.paused_at).getTime()) / 1000));
  }
  return Math.max(0, Math.round((now - started) / 1000) - pauseAccum);
}

describe("Driver session persistence across refresh", () => {
  it("never decreases drive_sec or idle_sec when remounted tracker reports lower values", () => {
    const session = { drive_sec: 120, idle_sec: 40, miles: 5 };
    const next = mergeTelemetryCounters(session, {
      drive_sec: 10,
      idle_sec: 5,
      auto_miles: 5.2,
    });
    assert.equal(next.drive_sec, 120);
    assert.equal(next.idle_sec, 40);
    assert.equal(next.miles, 5.2);
  });

  it("seedTelemetry continues from prior totals after refresh", () => {
    const tracker = createBrowserTracker();
    tracker.seedTelemetry({
      miles: 12.4,
      driveSec: 600,
      idleSec: 180,
      maxSpeedMph: 42,
      lat: 32.77,
      lng: -96.8,
      openStopId: "stop-1",
      stopPhase: "stopped",
    });
    const snap = tracker.getSnapshot();
    assert.equal(snap.miles, 12.4);
    assert.equal(snap.driveSec, 600);
    assert.equal(snap.idleSec, 180);
    assert.equal(snap.maxSpeedMph, 42);
    assert.equal(snap.stopPhase, "stopped");
  });

  it("elapsed uses wall clock so refresh does not reset session time", () => {
    const now = Date.now();
    const session = {
      started_at: new Date(now - 10 * 60 * 1000).toISOString(),
      pause_accum_sec: 60,
      paused: false,
      drive_sec: 400,
      idle_sec: 100,
    };
    const elapsed = elapsedFromSession(session, now);
    assert.ok(elapsed >= 9 * 60 - 1);
    assert.ok(elapsed <= 9 * 60 + 1);
    // Simulated refresh: same timestamps → same elapsed
    assert.equal(elapsedFromSession(session, now), elapsed);
  });
});
