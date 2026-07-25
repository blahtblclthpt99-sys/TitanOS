# Driver Hub Repair & Feature Completion

**Date:** 2026-07-13  
**Scope:** Driver Hub toggles, mile tracking, live stats, tooltips, Tax Center Mile Tracker, UX polish.

## Fixes delivered

### Toggles (Driving / Requesting a ride / mode)
- Driving ON/OFF shows busy state (`aria-busy`, disabled while saving) and reloads saved state on failure so UI cannot stay desynced from storage.
- Switching to **Requesting a ride** while Driving is ON ends the shift, saves miles, and syncs tax before flipping mode.
- Requesting-a-ride toggle persists via prefs and surfaces errors with toast + inline alert.
- Mode / ride / drive controls use `aria-pressed` and clearer `aria-label`s.

### Mile Tracker (shift + Tax Center)
- Shared validation in `src/lib/driverHubMath.js` (`parseMilesInput`): rejects empty, NaN, negative, and oversize values; rounds to 0.1 mi.
- Shift miles update live dashboard totals as you type; Save / blur persist; tax sync on save while driving.
- Tax Center `MileTracker`: validation, create + **edit**, delete recalculates totals, load/save/delete errors, no zero-mile saves.

### Driver statistics
- `computeShiftDashboard` centralizes miles, stops, hours, est. earnings, fuel, MPG, profit, jobs completed, tax estimate.
- Live timer: dashboard `useMemo` depends on `tick` so elapsed time and earnings refresh every second (fixed stale cache).
- Fuel strip uses the same live `displayMiles` as the dashboard.

### Counter explanations
- `StatHint` info icons on live shift metrics (miles, stops, earnings, fuel, profit, MPG, avg stop, tax est.).
- Tax Mile Tracker tooltips for Total Miles and Tax Deduction (what / how / when / why).

### UX
- Feature honesty banner on shift panel (device + tax sync; hotspots are estimates).
- Stronger empty/loading/error states on Mile Tracker; 44px touch targets on edit/delete.
- Driver Hub tabs already use proper `tablist` / `tab` roles.

### Tests
- `npm run test:driver` → `scripts/driver-hub.test.mjs` (included in `npm test`).

## Remaining concerns
- Earnings are **estimates** (time + miles + stops heuristic), not platform payouts — copy makes this clear.
- Hotspot demand is synthetic / time-of-day guidance, not live marketplace data.
- IRS rate is a constant (`IRS_MILEAGE_RATE_USD = 0.67`); update when IRS publishes a new rate.
- Shift session/stops still primarily localStorage; tax rows sync when signed in — offline conflicts are last-write-wins.
- Directory tab remains demo marketplace data (by design).
