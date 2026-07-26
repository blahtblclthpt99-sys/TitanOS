# TitanOS architecture

Map for humans. Agent product laws live in `.cursor/rules/` and `AGENTS.md` — link them; don’t duplicate.

**North star:** TitanOS is one operating system (domains + shared chrome), not a bag of features. Ship gate and pillars: [`docs/FINAL_OBJECTIVE.md`](./docs/FINAL_OBJECTIVE.md).

## Layers

```text
pages/                  Route screens (compose only)
  └─ components/
       ├─ shared/       PageShell, EmptyState, ExportMenu, …
       ├─ {domain}/     Driver, tax, layout, brand, …
       └─ ui/           Primitives (Button, Dialog, …)
  └─ lib/
       ├─ *Api.js       Feature services (payments, hire, messages, …)
       ├─ driverActivity/  GPS, DoorDash, journal, intelligence (barrel)
       ├─ driverOs/        Mission snapshot, workflow, Explorer (barrel)
       ├─ export/          Reporting export stack (barrel)
       └─ …              Cross-cutting (plan, theme, search, …)
  └─ api/               Supabase client facade (auth, entities, functions)
api/functions + _lib/   Vercel serverless + shared server helpers
shared/                 Pure JS (fees, tax, safePath) — Vite + Node
supabase/migrations/    Schema, RLS, indexes
```

## Import rules

1. Prefer **barrels**: `@/lib/driverActivity`, `@/lib/driverOs`, `@/lib/export`, `@/components/shared`.
2. Prefer **`*Api.js`** over sprinkling Supabase calls in leaves.
3. Money: server Fee Engine is source of truth (`docs/FEE_ENGINE.md`); client `platformFee` is display-only.
4. Tax vs GPS: Job Location ≠ Driver Location (`docs/LOCATION_TAX_ARCHITECTURE.md`).
5. UI chrome: `PageShell` + `PageHeader` + Empty / Loader / Error triad.
6. Nav/IA: extend `src/lib/nav-items.js` — don’t invent ad-hoc groups.
7. Dual-runtime helpers belong in `shared/`, re-exported by thin client/API wrappers.

## Critical domains

| Domain | Public surface | Docs |
|--------|----------------|------|
| Driver Activity | `@/lib/driverActivity` | `src/lib/driverActivity/MODULE.md`, `docs/DRIVER_ACTIVITY_ENGINE.md` |
| Driver OS / Hub | `@/lib/driverOs` | `src/lib/driverOs/MODULE.md` |
| Export / Reporting | `@/lib/export` + `ExportMenu` | `src/lib/export/MODULE.md` |
| Fees | `shared/feeEngine.js` + `api/_lib/feeConfig.js` | `docs/FEE_ENGINE.md` |
| Tax / Job Location | `shared/taxEngine.js` | `docs/LOCATION_TAX_ARCHITECTURE.md` |
| Scale | entity caps, indexes, trips | `docs/SCALE_READINESS.md` |

## Shared UI kit (use these)

- Layout: `PageShell`, `PageHeader`
- States: `EmptyState`, `PageLoader`, `ErrorState`, `ComingSoonState`
- Actions: `ExportMenu`, `FilterChip`, `ToggleRow`, `DeleteButton`
- Feedback: `SyncStatus`, `OfflineIndicator`, `FeatureHonestyBanner`

Import via `@/components/shared` when possible.

## Where new code goes

| You are adding… | Put it in… |
|-----------------|------------|
| A screen | `src/pages/` + nav item |
| Reusable chrome | `src/components/shared/` |
| Domain widget | `src/components/<domain>/` |
| Client service | `src/lib/<feature>/` or `*Api.js` |
| Server endpoint | `api/functions/` + helpers in `api/_lib/` |
| Pure calculation | `shared/` |
| Schema change | `supabase/migrations/NNN_*.sql` |

## Further reading

- Onboarding: [`docs/ONBOARDING.md`](./docs/ONBOARDING.md)
- Contributing: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Agent rules: [`AGENTS.md`](./AGENTS.md)
