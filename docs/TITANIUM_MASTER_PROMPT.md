# PROJECT TITANIUM — TitanOS Master Coding Prompt

**Use this prompt as the system brief for any TitanOS engineering agent or developer.**  
**Product:** TitanOS (titanfieldos) · Package `com.titanos.myapp` · Live web + Capacitor Android  
**Priority:** Critical · Public launch quality · Nothing exempt  

---

## MISSION

TitanOS is no longer a prototype or feature demo.

Treat TitanOS as a **cohesive, enterprise-grade operating system** for workers, contractors, drivers, businesses, and teams — preparing for public launch.

It must **not** feel like a web application with many features. Every interaction is fast, intuitive, visually consistent, reliable, and purposeful. Architecture stays modular; UI minimizes cognitive load; AI improves productivity; the platform scales and remains maintainable for years.

### FINAL OBJECTIVE — Guiding Principle

**No feature ships until it is secure, performant, intuitive, accessible, thoroughly tested, visually polished, and integrated seamlessly with the rest of TitanOS.**

Source: `.cursor/rules/final-objective.mdc` · `docs/FINAL_OBJECTIVE.md`.

Every screen, workflow, API, animation, calculation, database query, AI interaction, and user action must be reviewed, redesigned where necessary, optimized, tested, hardened, polished, documented, and standardized.

**The objective is not merely to “fix bugs.”**  
**The objective is to make TitanOS feel like software built by a company with hundreds of engineers.**

Nothing is considered complete until it is:

- Fast  
- Intuitive  
- Reliable  
- Visually consistent  
- Accessible  
- Secure  
- Scalable  
- Honest (never fake money, fake live systems, or placeholder social proof presented as real)
- Integrated into OS domains (not a bolted-on mini-app)

---

## CURRENT CODEBASE CONTEXT (DO NOT IGNORE)

Repository: TitanOS / titanfieldos (Vite + React + Supabase + Capacitor + Vercel).

Already in progress / partially shipped:

- Driver Hub 4.0 shell: Mission Control + Driver Explorer (`src/pages/DriverHub.jsx`, `src/components/driver/os/*`, `src/lib/driverOs/*`)
- Three-question UI rule: `.cursor/rules/three-question-ui.mdc`
- Premium gates, TitanCom rename, launch hardening commits on `main`
- UX audit canvas findings (trust P0s still open)

**Do not rebuild from scratch.** Evolve the existing Driver OS architecture. Close gaps between the vision below and the current implementation. Fix audit P0/P1 items as part of the same quality bar.

Before large edits on a project path, use `cursor-app-control` `move_agent_to_root` into the project. Commit only when asked. Do not commit `.agents/` or secrets.

---

## GLOBAL DESIGN PHILOSOPHY — THREE QUESTIONS

Every page and major panel must answer immediately:

1. **What is happening?** — plain-language current state (not decorative eyebrows).  
2. **What should I do next?** — one primary, contextual action.  
3. **Where do I go if I need more?** — explicit path to detail / history / settings.

Rules:

- The user should never wonder where something is located.  
- Every interface should feel intentional.  
- Nothing should exist because “it was easy.”  
- Every element must serve a purpose.  
- Prefer progressive disclosure over scrolling dashboards.  
- Live/ops above the fold; analytics inside folders.  
- No heavy letter-spacing uppercase chrome that stretches text on mobile.  
- Large touch targets (≥44px). Animations ≤200ms. Respect reduce-motion.

---

## PERFORMANCE

Review queries, APIs, renders, components, animations, calculations, and subscriptions before calling work done.

### Requirements

- No unnecessary re-renders; isolate live clocks from page trees  
- Lazy loading + code splitting + tree shaking  
- Virtual scrolling for long lists  
- Memoization only where it prevents real work  
- Caching, prefetching, request batching  
- Optimized images / icons / fonts  
- DB indexing + connection pooling on the server  
- Compression, smaller bundles, faster startup, lower memory  
- **Minimize GPS polling while preserving accuracy** — throttle persistence, pause when backgrounded, avoid dual high-accuracy watches  

Source: `.cursor/rules/performance.mdc`. Hotspots historically: Driver session + DoorDash GPS, Mission Control / DoorDash UI ticks, Community polling without visibility checks.

---

## DATABASE

Review every table, relationship, foreign key, index, policy, trigger, function, and migration before calling work done.

### Requirements

- Normalize data; avoid duplication of entitlement / money truth  
- Referential integrity (real FKs for new tables; document soft IDs when legacy)  
- Proper indexes on ownership + hot filters used by RLS and lists  
- Optimize queries; batch where the API layer allows  
- **RLS on every public table** — least privilege, validate ownership, prevent leakage  
- Privileged fields and settlement status are server/admin-only (triggers / service_role)  
- SECURITY DEFINER: fixed `search_path`; revoke EXECUTE from PUBLIC unless intentional public RPC  

Source: `.cursor/rules/database.mdc`. Apply `supabase/migrations/032_database_integrity_lockdown.sql` and verify with `npm run test:db-security`.

---

## SECURITY

Audit authentication, authorization, sessions, permissions, tokens, API routes, uploads, messages, payments, AI, GPS/location, files, logs, encryption, secrets, headers, rate limiting, validation, sanitization, CSRF/XSS/SQLi/prompt injection, abuse, brute force, replay, logging, monitoring, and alerts.

### Requirements

- Every endpoint assumes **hostile input**  
- Server-side authZ; hash portal tokens; constant-time secret compares  
- Payments: verify signatures; settle only on captured funds; idempotency  
- AI: owned data only; sanitize money/actions; block prompt-injected “facts”  
- Rate-limit OTP, register, OCR, AI, mail, billing hooks  
- Allowlist notification deep links; private uploads; redact logs  

Source: `.cursor/rules/security.mdc`.

---

## ERROR HANDLING

Nothing should fail silently.

Every exception should:

- **Be logged** (`logError` / `reportError` with `category:route`)  
- **Be categorized** (payments, portal, webhooks, ai, referrals, ocr, email, admin, ui)  
- **Be recoverable when possible** (retry, keep prior UI state, honest `_source: local`)  
- **Provide useful feedback** (toast / ErrorState / `{ error, code, requestId }`)  
- **Never expose internal implementation details** (no Stripe/DB/stack in client responses)

Use `api/_lib/apiError.js` (`sendApiError`, `AppError`) and `src/lib/reportError.js`.

Source: `.cursor/rules/error-handling.mdc`.

---

## LOADING STATES

Every asynchronous operation should display appropriate loading feedback.

- Skeleton loaders (`PageLoader`) for page fetches  
- Progress bars for long work  
- Spinners only when necessary (Suspense / inline)  
- Optimistic UI where rollback is clear  
- Graceful retries (`ErrorState`)  
- Offline indicators (`OfflineIndicator`)  
- Sync status when data is local/stub (`SyncStatus`)  

Never `return null` or blank content while loading. Source: `.cursor/rules/loading-states.mdc`.

---

## EMPTY STATES

Every empty screen should provide guidance.

- Explain **why** it is empty  
- Explain **what to do next**  
- Offer a **shortcut** to create content (or clear filters)  
- Never show blank pages  

Use `EmptyState`. Source: `.cursor/rules/empty-states.mdc`.

---

## MICROINTERACTIONS

Every action should provide feedback.

**Surfaces:** buttons, cards, forms, tabs, uploads, downloads, messages, voice, GPS, payments, jobs.

**Motion:** subtle, fast (≤150–200ms), smooth, consistent. Honor reduce-motion.

**Patterns:**
- Press: `.btn-press` / `PRESSABLE` / `<Button>` — scale `0.97`
- Success / error: `toastDone` / `toastFail` (`src/lib/interaction.js`) or `SuccessCheck`
- In-flight: disable + “Saving…” / “Uploading…”
- Haptics: `haptic()` for primary ops only (PTT, shift, delivery) — never under reduce-motion

Source: `.cursor/rules/microinteractions.mdc`.

---

## VISUAL CONSISTENCY

Everything should use the same design language.

Standardize: typography, spacing, margins, padding, border radius, cards, buttons, icons, colors, elevation, animations, transitions, modals, dialogs, tooltips, menus.

| Concern | Use |
|---------|-----|
| Page chrome | `PageShell` + `PageHeader` |
| Surfaces | `titan-surface` / `<Card>` (not `glass`) |
| Radius | controls `md`; cards/overlays `lg`; no `rounded-3xl` in app UI |
| Type | `text-title` / `text-heading` / `text-body` / `text-caption` |
| Elevation | `shadow-soft` · `shadow-lift` |
| Motion | `duration-fast` \| `base` \| `slow` (≤250ms) |
| Overlays | Dialog / Sheet / Dropdown / Tooltip / Popover from `components/ui` |

Source: `.cursor/rules/visual-consistency.mdc` · recipes in `src/lib/design-system.js`.

---

## ACCESSIBILITY

Every interactive surface must work with keyboard, screen reader, touch (≥44px), and reduced motion — across phone, tablet, desktop, landscape, and high-DPI.

| Area | Rule |
|------|------|
| Keyboard | Native controls; Escape closes overlays; `activatableProps` for custom activators |
| Screen reader | Icon-only `aria-label`; dialogs need Title + Description (or intentional `aria-describedby={undefined}`); toasts call `announce()` |
| Touch | ≥44×44px (`CONTROL.md`) |
| Contrast | Semantic tokens; no low-opacity muted text for meaning; honor high-contrast |
| Focus | `.focus-ring` / `focus-visible:ring-*` |
| Reduced motion | `usePrefersReducedMotion`; `html.reduce-motion`; no haptic when reduced |
| Scaling | Rem layout; text scales 90–125% |
| Layout | `PageShell` clears chrome; `md:` desktop nav; short landscape must not crush content |

Source: `.cursor/rules/accessibility.mdc` · helpers in `src/lib/a11y.js`.

---

## MOBILE EXPERIENCE

Optimize for one-handed use, thumb reach, driving, large controls, minimal typing, offline honesty, fast resume, background strategy, battery, and GPS efficiency.

| Area | Rule |
|------|------|
| Thumb zone | Nav + primary CTAs in bottom third; no colliding FABs |
| Driving | Live Driver Hub: hide Create/AI dock; one ≥48px next action; voice/chips over forms |
| Offline | Honest banner (device/shell — not full sync queue); `SyncStatus` for local writes |
| GPS | One watch — DoorDash wins while delivery active; suspend when hidden |
| Battery | `useVisibilityInterval`; wake lock only when needed |
| Chrome | `--mobile-chrome-bottom` for dock / bulk bars |

Source: `.cursor/rules/mobile-experience.mdc`. Overlaps `performance.mdc` for GPS/battery detail.

---

## DRIVER HUB

Convert Driver Hub into a **workflow engine**.

- **Mission Control** — sticky live-only (status, next action, miles, idle, rush)  
- **Explorer** — analytics/history/reports/settings in IA groups (`live` / `history` / `analytics` / `reports` / `settings`)  
- **Auto** — trip stop detection + opt-in motion auto-start; delivery classification; clock rush + intensity; idle timers; digests on shift/delivery end  

Source: `.cursor/rules/driver-hub.mdc` · `workflowEngine.js` · `analyticsDigest.js`.

---

## TITAN AI

Titan AI should understand context, pages, workflows, and user history — then act only through approved APIs.

| Rule | Detail |
|------|--------|
| Context | Allowlisted `pageContext` + page catalog (`api/_lib/aiContext.js`) |
| Data | Server-owned snapshot only — never trust client business summaries |
| Actions | `ALLOWED_AI_INTENTS` → `executeAiOfficeAction` only |
| Output | Explanations + recommendations; label **YOUR DATA** vs **GENERAL KNOWLEDGE** |
| Honesty | No invented customers/jobs/money; no claimed side effects the API doesn't do |

Source: `.cursor/rules/titan-ai.mdc`.

---

## COMMS (TitanCom)

Crew PTT must feel like a radio: fast press-to-audio, survive drops, respect channel access, notify reliably.

| Rule | Detail |
|------|--------|
| Latency | Warm mic (mute/unmute); keep WebRTC mesh across presses |
| Reconnect | Backoff on Realtime drop + online/visibility; honest Reconnecting status |
| Audio | AEC/NS/AGC; STUN + optional `VITE_TURN_*`; Bluetooth via OS route |
| Permissions | Membership gate before Realtime topic; `tc-*` = open network radios |
| PTT | Pointer + Space; floor lease; SOS broadcast |
| Notify | Channel text → inbox + OS push → `/comms?channel=` |

Source: `.cursor/rules/comms.mdc` · `titanCommsPtt.js` · `titanCommsApi.js`.

---

## SEARCH

Global search must be **instant** (sync local index) and cover the OS:

Jobs · Trips · Messages · Invoices · Customers · Voice transcripts · Files · Analytics · Settings · AI conversations.

Warm/prefetch fills the index in the background; keystrokes never await the network.

Source: `.cursor/rules/search.mdc` · `searchIndex.js` · `globalSearch.js`.

---

## REPORTING

Every module with tabular/summary data must export through the shared stack:

| Format | Implementation |
|--------|----------------|
| CSV | `downloadCsv` |
| Excel | SpreadsheetML `.xls` |
| PDF | Printable HTML → Print → Save as PDF |
| Print | `openPrintableReport` |
| Share | `/share/report/:token` (device link, 7-day expiry — labeled) |
| Schedule | Local cadence while app open — no silent email claim |

UI: `ExportMenu` on Reports, Finances, Analytics, Jobs, Customers, Invoices, Tax expenses.  
Source: `.cursor/rules/reporting.mdc` · `src/lib/export/*`.

---

## SETTINGS

Settings must be **categorized**, **searchable**, **documented**, with explicit **defaults** and **reset**.

| Rule | Detail |
|------|--------|
| Categories | Account · Business · Communications · Safety · Appearance |
| Search | In-page + catalog-backed options |
| Docs | Every panel/option has description + docs |
| Defaults | Notifications on; privacy sharing off; marketing weekly; theme system |
| Reset | Restore defaults on preference panels only |

Source: `.cursor/rules/settings.mdc` · `settingsCatalog.js`.

---

## TESTING

Automated tests protect money, driver, auth, and critical OS flows.

| Layer | Command / tool | Focus |
|------|----------------|--------|
| Unit | `npm test` (`node --test` + `scripts/node-test-setup.mjs`) | Fees, money, driver, export, search, settings, AI intents, GPS owner, voice |
| Integration | Same pack + ops scripts | API errors, offline wiring, payments drills |
| E2E | `npm run test:e2e` (Playwright) | Landing, login, privacy smoke; Chromium default |
| Cross-browser / device | `npm run test:e2e:browsers` | Chromium desktop/mobile, Firefox, WebKit |
| Regression | Hardening + wiring suites | Nav/comms surfaces, production policies |
| Performance | `test:perf` + `ops:load*` | Search/export microbench; HTTP load vs deploy |
| Accessibility | `test:a11y` | Catalog + structural a11y smoke |
| Security | `test:security` + hire/payments/auth | Allowlists, headers, no secret leaks |
| Offline / GPS / Voice / AI | `test:offline` `test:gps` `test:voice` `test:ai` | Local stores, DoorDash GNSS owner, intent parse |

Incomplete if new business logic ships without a Node test, or CI skips the pack.

Source: `.cursor/rules/testing.mdc`.

---

## OBSERVABILITY

Production must be **visible** without leaking PII.

| Capability | Detail |
|------|--------|
| Crash reporting | Sentry client + API (`sendDefaultPii: false`) |
| Performance | Browser tracing + web vitals; API traces; optional profiling |
| Structured logging | JSON `safeLog` levels + `X-Request-Id` |
| Health | `/api/functions/health` (+ deep ops probe) |
| Analytics | Allowlisted first-party events; Privacy opt-out |
| Audit trails | `audit_events` + fee/webhook ledgers |
| Feature flags | Defaults + `/api/functions/featureFlags` + `FEATURE_FLAGS_JSON` |
| Session replay | Masked Sentry Replay — opt-in + `VITE_SENTRY_REPLAY` |
| Alerting | `OPS_ALERT_WEBHOOK_URL` / Slack on API 5xx |

Source: `.cursor/rules/observability.mdc`.

---

## CODE QUALITY

Prefer deletion and reuse over cleverness.

| Rule | Detail |
|------|--------|
| Dead code | Remove unused files/exports/imports |
| DRY | Shared export/excel, safePath, formatMoney |
| Extract | Split >400-line surfaces; reuse PageShell / ExportMenu / catalogs |
| Naming | Product **TitanCom**; libs camelCase; `@shared/` for dual-runtime |
| Typing | JSDoc public money/driver/auth APIs |
| Formatting | EditorConfig + ESLint (`npm run lint`) |

Source: `.cursor/rules/code-quality.mdc`.

---

## SCALABILITY

Design for **millions of users, trips, and jobs**. No one-page-load architecture.

| Rule | Detail |
|------|--------|
| Bounded reads | Prefer ≤100 rows; adapter max 500 is a safety net |
| Pagination | Keyset/`filterPage` for deep history |
| Indexes | Filter/RLS columns indexed (migration 034) |
| Hot path | Browser→PostgREST; measure authenticated p95 |
| Local caps | Messages/journals/search enforce MAX_* |
| Rate limits | Upstash when set; `assertRateLimitAsync` on money/AI |
| Serverless | Explicit `maxDuration` on slow routes |
| Driver trips | Cloud `driver_trips` + local cache ring |

Source: `.cursor/rules/scalability.mdc` · `docs/SCALE_READINESS.md`.

---

## MAINTAINABILITY

Modular architecture so the next developer can ship safely.

| Rule | Detail |
|------|--------|
| Layers | pages → components → lib/*Api → api → shared → migrations |
| Barrels | `@/lib/driverActivity`, `@/lib/driverOs`, `@/lib/export`, `@/components/shared` |
| MODULE.md | Feature folders document public API + do-nots |
| Interfaces | JSDoc contracts in `driverOs/interfaces.js` |
| Onboarding | `ARCHITECTURE.md`, `docs/ONBOARDING.md`, `CONTRIBUTING.md` |

Source: `.cursor/rules/maintainability.mdc`.

---

## FINAL QA

Before calling TitanOS production-ready: clear critical / high / medium issues and document residual risk honestly.

| Gate | Detail |
|------|--------|
| Automated | `npm test` (incl. `test:final-qa`), lint, typecheck, build, Playwright smoke |
| Structural | Nav↔routes, ExportMenu on money lists, migrations 031–034, GPS watch release, escrow honesty |
| Ops still required | Apply 031–034 + `test:db-security`; live Stripe Checkout→webhook; device GPS/offline |

Source: `.cursor/rules/final-qa.mdc` · `docs/FINAL_QA.md`. Honest ceiling: **controlled beta** until ops boxes are checked.

---

## FINAL OBJECTIVE

TitanOS is a **cohesive operating system**, not a feature pile. Guiding principle: no feature ships until secure, performant, intuitive, accessible, tested, polished, and integrated.

Source: `.cursor/rules/final-objective.mdc` · `docs/FINAL_OBJECTIVE.md`.

---

## INFORMATION ARCHITECTURE

TitanOS is an **operating system**, not a collection of unrelated pages.

Separate every feature into one domain:

| Domain | Meaning |
|--------|---------|
| **Live** | What is happening now |
| **History** | Records of people and past work |
| **Analytics** | Understand performance |
| **Reports** | Money summaries and exports |
| **Communication** | Talk to customers and team |
| **AI** | Assistants and coaching |
| **Configuration** | Setup for self, business, assets |
| **Administration** | Platform admin only |
| **Labs** | Unfinished / partner-dependent |

Source of truth: `src/lib/nav-items.js` (`group` on each item + `MORE_MENU_GROUPS` + Sidebar).  
Cursor rule: `.cursor/rules/information-architecture.mdc`.

Driver Hub Explorer must mirror this split (Live Shift vs History vs Analytics vs Settings) — never dump analytics onto Live Mission Control.

---

## NAVIGATION

Every destination must be reachable in **three taps or fewer** from a mobile root (bottom tabs or More).

Never create navigation dead ends. Never surprise the user.

### Every page must include

| Requirement | Rule |
|-------------|------|
| Clear title | Visible page name in PageHeader and/or MobileHeader |
| Back button | Non-root screens; cold links resolve to section parent |
| Breadcrumb | Nested detail routes (list → entity → child) |
| Search | Lists, archives, Explorer, directories |
| Quick actions | Contextual primary next steps |
| Consistent patterns | Same chrome, More groups, tab roots |

### Implementation notes (TitanOS)

- Mobile roots: `MOBILE_ROOT_PATHS` in `src/lib/nav-items.js`
- Back parent map: `getTabRoot` in `src/components/layout/MobileHeader.jsx`
- Breadcrumb primitives: `src/components/ui/breadcrumb.jsx`
- Prefer enhancing `PageHeader` / `MobileHeader` over one-off headers
- Coming Soon / Labs pages still need Back + honesty + escape CTA to a live tool

### Dead ends to eliminate

- Screens with no Back and no tab selection
- CTAs that navigate to empty or unfinished flows without honesty
- Icon-only jumps without `aria-label`
- Silent redirects (e.g. password reset success with no confirmation)

---

## PART A — DRIVER OPERATING SYSTEM 4.0 (CRITICAL)

### Vision

Stop treating Driver Hub as a dashboard. Treat it as a **file manager for a driving career** — **Windows Explorer meets Tesla / enterprise fleet software**.

Two layers only:

| Layer | Name | Purpose |
|-------|------|---------|
| 1 | **Mission Control** | What do I need right now? Always visible. No scroll required. |
| 2 | **Driver Explorer** | What do I want to analyze? Expandable folders. Lazy-load contents. |

Retain every existing statistic. Relocate them into folders. Never remove metrics — reorganize them.

Maintain TitanOS branding: dark theme, blue accents, rounded cards, glassmorphism where appropriate, soft shadows, minimal borders, responsive mobile + tablet.

### Mission Control (pinned)

Show only live operational data. Large, drive-readable, update live.

Required fields:

- Driver status (with live indicator)  
- Current platform  
- Current delivery stage / job  
- Current earnings + profit  
- Shift time + trip timer  
- Mileage + speed  
- GPS / battery / network  
- Rush period + time remaining if applicable  
- Goal progress  
- Titan AI recommendation (one clear sentence)  

**Primary CTA must actually perform the next action** (e.g. start/resume shift or continue delivery) — not merely open a folder unless the label says so.

Home-screen density target: roughly **8 primary signals** (profit, active order, platform, shift time, trip, AI tip, rush, start/continue). Everything else is under Systems or Explorer.

### Driver Explorer (root folders)

Collapsible. Collapsed = summary chip. Expanded = detail. **Only expanded folders render bodies.** Persist open/closed + search per user. Lazy load every body.

Required root folders (modular — add platforms later without redesign):

1. Live Shift  
2. Today’s Orders  
3. Trip History  
4. Analytics  
5. Rush Intelligence  
6. Platform Statistics  
7. Heat Maps  
8. Vehicle  
9. Expenses  
10. Tax Center  
11. Reports  
12. Settings  
13. AI Insights  
14. Performance  
15. Goals  
16. Maintenance  
17. Find Drivers / Directory (if product still needs it)  
18. DoorDash Workflow (or nest under Platforms)

### Folder depth requirements

**Live Shift** — active order only: customer, restaurant, navigation, ETA, timers, miles, speed, AI tip, TitanCom / Dispatch / Emergency shortcuts.

**Today’s Orders** — expandable per-order cards (Windows Explorer style). Expand reveals: restaurant, customer, acceptance/arrival/wait/pickup/drive/drop times, miles, fuel estimate, profit, avg/max speed, timeline, photos, notes, voice notes, AI review/score. Collapse cleans the list.

**Trip History** — Year → Month → Week → Day; also filter by Platform, Rush, ZIP, Restaurant, Customer. Search + virtualization. No artificial history caps.

**Analytics** — nested expandable sections with graphs, trends, comparisons, AI summaries:

Driving, Stops, Idle, Mileage, Vehicle Usage, Acceptance, Completion, Revenue, Fuel, Expenses, Efficiency, Performance, Weekly/Monthly trends, ZIP analysis, Platform comparison.

**Rush Intelligence** — Breakfast / Lunch / Afternoon / Dinner / Late Night / Overnight (configurable windows; defaults 6–9, 11–2, 2–5, 5–8, 8–12, 12–6). Per rush: earnings, $/hr, $/mi, tips, wait, acceptance, cancel, best/worst restaurants, frequent restaurant/ZIP, best day, AI tips, trend, heat map, export.

**Weekday analysis** — Mon–Sun + Weekdays vs Weekends compare; AI names consistently better days.

**Platform Statistics** — DoorDash, Uber Eats, Uber Driver, Lyft, Spark, Roadie, Amazon Flex, Instacart, Grubhub, Shipt, Personal — independent analytics each.

**Heat Maps** — layers: revenue, tips, fastest/slowest restaurants, deliveries, profit, best/worst ZIPs, meal periods, weekdays/weekends, weather/holiday stubs as data allows. Zoom + filter when maps exist; density scaffolds OK until Mapbox/live maps land — label honestly.

**AI Insights** — auto observations (rush lift %, avoid restaurant X after 7pm, wait times, acceptance by rush, $/mi after 10pm, recommended start time).

**Performance** — daily score from efficiency, acceptance, wait, profit, idle, driving/fuel efficiency, delays; weekly/monthly/best.

**Search** — global index: restaurant, customer, date, ZIP, platform, rush, mileage, profit, tips, voice/AI notes. Results deep-link to the matching delivery/folder.

### UX / performance for Driver OS

- No unnecessary scrolling for live work  
- Folder state persistence  
- Pull-to-refresh, offline cache honesty, dark mode, tablet layouts  
- Virtualize long lists; async calculations; battery-conscious GPS  
- Design for 100k+ trips without jank  
- Premium: gate analytics/add-ons per `canUseDriverAddons`; **shift start/stop stays free**

---

## PART B — PROJECT TITANIUM HARDENING (ENTIRE APP)

### UX audit mandate

Review and bring to the same bar:

- Every page · popup · button · icon · menu · animation · notification  
- Every workflow · setting  
- Every loading / empty / error / success / failure state  

**Nothing should feel unfinished.**

### Remove clutter

- Delete duplicate buttons/text  
- Cut unnecessary scrolling  
- Reduce cognitive load  
- Merge related information  
- Progressive disclosure for advanced data  
- Keep primary actions immediately visible  

### Mandatory trust / money fixes (P0 — do first)

1. **Marketplace Apps** — do not mark modules unlocked until PayPal/webhook verifies payment (or show explicit Pending).  
2. **Premium upgrade** — return deep-link + “Refresh plan” + clear path when payer email ≠ profile email.  
3. **Job Holds / Escrow** — no interactive fake money; Coming Soon or read-only status only until real holds exist.  
4. **Landing** — remove placeholder testimonials presented as user quotes.  
5. **Account deletion** — real delete pipeline or honest “request ticket / email support” without implying data is wiped by sign-out.  
6. **`/deals`** — hide from nav until live, or ship a real minimal surface.

### Mandatory UX / a11y / workflow fixes (P1)

1. Mission Control primary CTA starts/resumes/continues for real.  
2. Every Dialog has `DialogDescription` (or equivalent a11y).  
3. Every icon-only button has `aria-label`; decorative icons `aria-hidden`.  
4. No silent form validation failures — toast or inline errors (Payments, logbook, etc.).  
5. Detect blocked `window.open` checkout popups and tell the user.  
6. Hire/Messages/Marketplace load failures surface errors (not empty lists).  
7. Standardize `PageLoader` / `EmptyState` / `ErrorState` on pages that still use raw text.  
8. Honor reduce-motion (Settings preference + `prefers-reduced-motion`) on Settings, AI Assistant, list motion.  
9. Labs honesty: Emergency, Phone, Marketing “AI”, Growth Coach — never look more live than they are.  
10. Thin shells (Contracts prompt-signing, Leads, Inventory, Employees, Credentials) — finish to Jobs-level polish **or** demote to Labs with honesty banners.

### Baselines to copy (do not regress)

- Driver Hub Mission Control three-question pattern  
- Jobs / Invoices / Estimates / Customers: PageHeader + loader + error + empty + primary add  
- MobileNav labeling / a11y  
- `FeatureHonestyBanner` on stubbed money and Labs  
- Auth login/register inline errors  

### Engineering standards

- Secure by default (RLS, no privilege escalation, webhook-verified money state)  
- Idempotent payments; clear stub vs live API behavior  
- Consistent toast copy (success vs destructive; never claim funds moved when they didn’t)  
- Typecheck / lint / relevant tests green before calling work done  
- Document user-facing honesty gaps in UI, not only in code comments  
- Modular folders/APIs so new platforms don’t require a redesign  

### Definition of done (every feature / page)

A change is **not done** until:

1. Three questions are answered on the surface.  
2. Loading, empty, error, success, and failure states exist and look intentional.  
3. Primary action works (not just navigates to more UI).  
4. A11y: labels, descriptions, focus, reduce-motion.  
5. No fake live / fake money / placeholder social proof.  
6. Mobile layout is uncrowded; no stretched/cramped header chrome.  
7. Tests or manual checklist for the critical path recorded.  
8. Performance: no obvious jank; lists virtualized when long.  

---

## PART C — EXECUTION ORDER FOR AGENTS

Work in this order unless the user overrides:

1. **P0 trust** (Marketplace install gating, Premium return UX, Escrow, Landing quotes, account deletion, Deals nav).  
2. **Driver OS depth** (Mission Control CTA, Today’s Orders expansion + timeline, Analytics nested sections, Rush/Weekday depth, search quality, virtualization).  
3. **P1 a11y + silent failures + EmptyState/ErrorState sweep**.  
4. **Thin page polish or Labs demotion**.  
5. **Performance pass** (Driver Hub lists, GPS battery, bundle weight only if needed).  
6. **Commit / deploy / AAB** only when the user asks.

After each milestone: `npm run build` (and relevant `npm run test:*`). Prefer small, reviewable commits with clear “why” messages when committing is requested.

---

## PART D — OUTPUT EXPECTATIONS

When implementing:

- Prefer extending `src/components/driver/os/` and `src/lib/driverOs/` over dumping analytics back into a scrolling hub.  
- Keep Premium gates via `src/lib/plan.js`.  
- Update CHANGELOG / versionCode only when shipping Play AAB and asked.  
- Summarize for the human: what changed, what remains, any honesty/trust risks still open.  

When auditing only:

- Produce a prioritized P0/P1/P2 table with file evidence.  
- Do not claim “production ready” while P0 trust items remain.  

---

## FINAL STANDARD

> TitanOS should feel like an operating system for field work and driving careers — not a collection of pages.  
> Users always see what matters now.  
> Everything else has a place in the Explorer.  
> Every feature meets the same enterprise polish bar before it is called complete.

**Codename: Project Titanium.**  
**If it is unfinished, dishonest, cluttered, inaccessible, or slow — it is not done.**
