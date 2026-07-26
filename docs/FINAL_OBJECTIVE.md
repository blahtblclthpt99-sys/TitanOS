# FINAL OBJECTIVE — TitanOS as an operating system

TitanOS should not feel like a web application with many features. It should feel like a **cohesive, enterprise-grade operating system** for workers, contractors, drivers, businesses, and teams.

Every interaction should be **fast, intuitive, visually consistent, reliable, and purposeful**. The architecture should be **modular**, the interface should **minimize cognitive load**, the AI should **meaningfully improve productivity**, and the platform should be engineered to **scale** while remaining **maintainable for years**.

## Guiding Principle

> No feature ships until it is secure, performant, intuitive, accessible, thoroughly tested, visually polished, and integrated seamlessly with the rest of TitanOS.

If any checkbox would be “later,” the feature is not ready — demote to Labs with honesty, or finish the bar.

## Audiences (one OS)

| Audience | Primary domains |
|----------|-----------------|
| Workers / contractors | Live (Jobs, Hire, Schedule), History, Payments |
| Drivers | Driver Hub (Mission Control + Explorer), Tax, Reports |
| Businesses / teams | Companies, Employees, Comms, Analytics, Configuration |
| Platform admins | Administration |

Do not ship parallel “mini-apps” with their own chrome, nav, or money rules.

## Pillars → product laws

| Pillar | Source of truth |
|--------|-----------------|
| OS domains / IA | `.cursor/rules/information-architecture.mdc`, `nav-items.js` |
| Cognitive load / next action | `.cursor/rules/three-question-ui.mdc`, `navigation.mdc` |
| Visual polish | `visual-consistency.mdc`, `microinteractions.mdc` |
| Accessibility | `accessibility.mdc` |
| Performance | `performance.mdc`, `mobile-experience.mdc` |
| Security / money honesty | `security.mdc`, `database.mdc` |
| Reliability / states | `error-handling.mdc`, `loading-states.mdc`, `empty-states.mdc` |
| AI productivity | `titan-ai.mdc` |
| Scale | `scalability.mdc`, `docs/SCALE_READINESS.md` |
| Maintainability | `maintainability.mdc`, `ARCHITECTURE.md` |
| Quality gate | `testing.mdc`, `final-qa.mdc`, `docs/FINAL_QA.md` |

## Ship checklist (per feature)

- [ ] Secure (RLS / fail closed / no client privilege escalation)
- [ ] Performant (bounded lists, no dual GPS owners, pause when hidden)
- [ ] Intuitive (three questions answered; ≤3 taps from a mobile root)
- [ ] Accessible (≥44px targets, labels, reduce-motion, keyboard)
- [ ] Thoroughly tested (Node test for logic; structural/e2e when surface warrants)
- [ ] Visually polished (shared chrome + tokens; no one-off “demo” layouts)
- [ ] Integrated (correct domain, barrels/`*Api`, ExportMenu on list money pages, honesty if incomplete)

## Anti-patterns

- Feature island with unique layout and no Empty/Loader/Error
- Flat “more tools” dump instead of Live / History / Reports / …
- AI that invents actions or pretends to send money/email
- Labs/stub money UX that looks like live Stripe settle
- Second fee, tax, or GPS engine

## Status

Product laws and automated FINAL QA encode this objective. Live ops (migrations, Stripe settle, device QA) still gate calling the product **production-ready** — see `docs/FINAL_QA.md` (controlled beta until those boxes close).

Cursor rule: `.cursor/rules/final-objective.mdc`.
