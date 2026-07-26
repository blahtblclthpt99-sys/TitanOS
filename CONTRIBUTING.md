# Contributing to TitanOS

Thanks for helping. Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) and [`docs/ONBOARDING.md`](./docs/ONBOARDING.md) before large changes.

## Workflow

1. Branch from `main` / `master`
2. Keep PRs focused (one concern when possible)
3. Run locally:
   - `npm run lint`
   - Relevant `npm run test:*` or `npm test`
   - `npm run build` for UI-facing changes
4. Prefer extending existing modules over new parallel stacks

## Ship gate (FINAL OBJECTIVE)

No feature ships until it is **secure, performant, intuitive, accessible, thoroughly tested, visually polished, and integrated** with TitanOS domains — not a bolted-on page. Checklist: [`docs/FINAL_OBJECTIVE.md`](./docs/FINAL_OBJECTIVE.md).

## Code expectations

- Follow `.cursor/rules/` product laws (UI triad, security, scalability, maintainability)
- Use shared chrome: `PageShell`, Empty / Loader / Error
- Import feature code from barrels (`@/lib/driverOs`, `@/lib/driverActivity`, `@/lib/export`)
- No secrets in git; no privilege escalation via client entity updates
- Update MODULE.md / ARCHITECTURE when you change a public boundary

## PR checklist

- [ ] Lint clean on touched areas
- [ ] Tests for business logic / money / driver when applicable
- [ ] Migrations numbered and documented if schema changed
- [ ] Honesty banners for unfinished Labs surfaces
- [ ] No unbounded list pulls (prefer ≤100)

## Do not

- Commit `.env.local` or service-role keys
- Force-push `main`/`master` without explicit request
- Add a second fee/tax/GPS engine
- Invent new top-level nav groups without updating `nav-items.js` + IA rule
