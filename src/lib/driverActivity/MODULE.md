# MODULE — Driver Activity

**Public import:** `@/lib/driverActivity`

## Purpose

GPS telemetry, stops, DoorDash delivery workflow, trip journal, offer math, coach/voice helpers. Device-local ring buffers + optional cloud `driver_trips` sync.

## Public API

Import from the barrel (`index.js`), not deep paths, unless you are inside this folder.

Key surfaces:

- Trackers: `createBrowserTracker`, `createDoorDashTracker`
- Workflow: `doorDashWorkflow` exports (screens, history, live snapshot)
- Journal: `upsertTripJournal`, `listTripJournal`, `syncTripJournalRowToCloud`
- GNSS ownership: `gpsOwner` (`isDoorDashGpsActive`, events)
- Intelligence / offers / true cost / autopilot / coach / voice
- Excel: builds on `@/lib/export/excel` — do not fork SpreadsheetML

See `ACTIVITY_MODULES` in `index.js` for capability flags.

## Do not

- Start a second GPS watch while DoorDash owns GNSS
- Treat local `MAX_JOURNAL` as unlimited warehouse without cloud sync
- Put Mission Control layout here — that belongs in `driverOs` / `components/driver`

## Key files

| File | Role |
|------|------|
| `tracker.js` / `doorDashTracker.js` | Position pipelines |
| `gpsOwner.js` | Single-watch arbitration |
| `doorDashWorkflow.js` | Delivery stages |
| `tripJournal.js` | Per-leg history + cloud upsert |
| `intelligence.js` | Rush / worth / digests inputs |
| `MODULE.md` | This doc |

Longer narrative: `docs/DRIVER_ACTIVITY_ENGINE.md`
