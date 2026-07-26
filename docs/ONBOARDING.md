# Onboarding — TitanOS

First week map for a new developer. Setup details stay in the root [`README.md`](../README.md).

## Day 0 — run it

1. Node **20–24**, clone repo, `npm install`
2. Copy env (see README / `.env.example` if present): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
3. Apply pending Supabase migrations (through **034** for scale/audit) in SQL editor or CLI
4. `npm run dev` → http://localhost:5173
5. `npm test` (unit pack), `npm run lint`, `npm run build`

## Mental model (15 minutes)

Read in order:

1. [`docs/FINAL_OBJECTIVE.md`](./FINAL_OBJECTIVE.md) — OS feel + ship gate  
2. [`ARCHITECTURE.md`](../ARCHITECTURE.md) — layers + import rules  
3. [`AGENTS.md`](../AGENTS.md) — product laws agents/humans share  
4. One domain MODULE: [`src/lib/driverOs/MODULE.md`](../src/lib/driverOs/MODULE.md) or [`src/lib/export/MODULE.md`](../src/lib/export/MODULE.md)

## How we structure work

- **Pages compose**; services live in `src/lib` / `api/_lib`
- **Shared UI** before one-off layouts (`PageShell`, Empty/Loader/Error)
- **Barrels** for feature folders (`driverActivity`, `driverOs`, `export`)
- **Migrations** for anything durable (RLS, indexes, tables)
- **Honesty** — Labs/stubs must not look live (`FeatureHonestyBanner`)

## Before your first PR

- [ ] Touched files pass `npm run lint`
- [ ] Relevant `npm run test:*` green (or full `npm test`)
- [ ] Ship gate: secure / performant / intuitive / accessible / tested / polished / integrated (`docs/FINAL_OBJECTIVE.md`)
- [ ] New list pages use shared chrome + a row budget (scalability)
- [ ] New money/auth paths fail closed + tested
- [ ] Docs: MODULE / ARCHITECTURE updated if you moved a boundary

## Key scripts

| Command | Use |
|---------|-----|
| `npm run dev` | Local web |
| `npm test` | Full Node unit/integration pack |
| `npm run lint` | ESLint |
| `npm run build` | Production bundle |
| `npm run test:db-security` | Live DB checks (needs secrets) |
| `npm run ops:load:smoke` | Public edge soak |

## Who to ask / where to look

| Question | Look here |
|----------|-----------|
| Nav / IA | `src/lib/nav-items.js` |
| Plans / gates | `src/lib/plan.js` |
| Fees | `docs/FEE_ENGINE.md` |
| Tax vs GPS | `docs/LOCATION_TAX_ARCHITECTURE.md` |
| Scale claims | `docs/SCALE_READINESS.md` |
| Play / AAB | `PLAY_TESTING.md`, `npm run android:sign` |
