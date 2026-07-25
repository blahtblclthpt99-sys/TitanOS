# Driver Hub Evolution — Intelligent Driving Assistant

**Date:** 2026-07-25  
**Module:** `src/lib/driverActivity/` + Driver Hub “My shift” UI

## Summary

Driver Hub’s **My shift** tab is now powered by a modular **Driver Activity Engine**: work sessions with optional foreground GPS mileage, intelligent stop detection, live glanceable stats, automatic period aggregates, and tax-friendly CSV export. **Estimated earnings** widgets were removed.

## What shipped

| Capability | Implementation |
|------------|----------------|
| Remove Est. earn / profit widgets | Replaced live + recorded UI with drive/idle/speed/deductible metrics |
| Start / pause / resume / end session | `startDrivingSession`, `pauseDrivingSession`, `resumeDrivingSession`, `stopDrivingSession` |
| Auto miles / route sampling | `createBrowserTracker` via `watchPosition` (foreground only) |
| Stop detection | Speed + GPS stability + traffic grace + confirm threshold (`stopDetection.js`) |
| Live driving UI | `ActivityLiveDash` — large numerals, pause/resume, glance-only copy |
| Stats today/week/month | `computeActivityStats` + `ActivityStatsPanel` |
| Tax assistant | Deductible **estimate** (IRS rate × miles) + CSV export — **not tax advice** |
| Time between stops | Per-stop drive/distance legs, session timeline, daily between-stop summary, insights |
| Privacy | Explicit ack + Auto GPS toggle; tracking only while session active & ack’d |
| Manual correction | Miles input still available; sets `miles_source: "manual"` |
| Rename stops | Per-stop label field |

## Architecture

```
src/lib/driverActivity/
  geo.js            # haversine, speed, miles
  stopDetection.js  # pure stop state machine
  tracker.js        # browser GPS adapter
  stats.js          # period aggregates
  export.js         # CSV recordkeeping
  index.js          # facade + future module flags

src/components/driver/activity/
  useDriverActivityTracker.js
  ActivityLiveDash.jsx
  ActivityStatsPanel.jsx
```

`driverHubApi.js` remains the Hub persistence facade (localStorage). Directory / publish / capacity were not rewritten.

**Future expansion hooks** (`ACTIVITY_MODULES`): multi-vehicle, fuel logs, tolls, parking, receipts, maintenance, route optimization, safety alerts, fleet.

## Assumptions

1. **Foreground web GPS only** in this release — no Capacitor Geolocation plugin and no Android `ACCESS_FINE_LOCATION` yet.
2. Tracking requires **privacy acknowledgment** + **Auto GPS** + **active session**.
3. Stop default: ~45s traffic grace, ~90s confirm; configurable via `prefs.stopConfirmSec`.
4. Deductible estimate uses the in-app IRS standard mileage constant — for **recordkeeping**, not filing advice.
5. Session history remains **device-local** (existing Hub pattern); Tax Center sync still writes `mileage_trips` when miles &gt; 0.

## Limitations (user / OS confirmation required)

| Item | Status |
|------|--------|
| iOS/Android background tracking | **Not enabled** — requires native plugins + OS permission prompts |
| Battery impact | Watch uses `maximumAge: 4s` and ignores &lt;12m jitter; still drains more than manual entry |
| Permission denial | Falls back to manual miles with an on-screen message |
| Simulator / desktop | GPS may be unavailable or inaccurate — expect manual correction |
| Multi-vehicle / fuel / tolls | Scaffolded flags only |
| Cloud session sync | Not added (localStore + Tax Center bridge only) |

## Verification

| Check | Result |
|-------|--------|
| Unit tests `scripts/driver-activity.test.mjs` | Run with `npm run test:driver` |
| Estimated earnings removed from live/recorded UI | Code verified |
| Typecheck / lint | Run in quality pass |
| Live GPS on phone while driving | **MANUAL** — grant location, start session, drive, confirm miles/stops |
| Pause/resume | **MANUAL** |
| CSV export open in spreadsheet | **MANUAL** |
| Directory / capacity / publish regressions | Untouched by design — smoke **MANUAL** |

## Files touched

- New: `src/lib/driverActivity/*`, `src/components/driver/activity/*`, `scripts/driver-activity.test.mjs`, this doc
- Updated: `src/lib/driverHubApi.js`, `src/components/driver/DriverShiftPanel.jsx`, `package.json`
