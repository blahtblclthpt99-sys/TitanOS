# MODULE — Driver OS

**Public import:** `@/lib/driverOs`

## Purpose

Driver Hub *operating system* layer: Mission Control snapshot, workflow phase labels, Explorer folders, search, intent. Composes `driverHubApi` + `driverActivity` without owning GPS hardware.

## Public API

| Export | Role |
|--------|------|
| `buildMissionSnapshot` | Live “what now?” payload for Mission Control |
| `WORKFLOW_PHASE`, `resolveWorkflowPhase`, `phaseLabel` | Unified shift + DoorDash phase |
| `DRIVER_SESSION_EVENT`, `WORKFLOW_EVENT`, `ENGINE_EVENTS` | Cross-UI events |
| `folders` / Explorer helpers | Explorer grouping |
| `interfaces.js` | JSDoc contracts (`MissionSnapshot`, session shapes) |

## Do not

- Duplicate DoorDash stage machines here — call `driverActivity`
- Dump analytics onto Mission Control (Live vs History vs Analytics split)
- Import KeepAlive for event names — use `DRIVER_SESSION_EVENT` from this barrel

## Key files

| File | Role |
|------|------|
| `missionSnapshot.js` | Snapshot builder |
| `workflowEngine.js` | Phase resolution + events |
| `folders.js` / `explorerState.js` | Explorer IA |
| `search.js` / `intent.js` | Hub search / intents |
| `interfaces.js` | Typed contracts |
