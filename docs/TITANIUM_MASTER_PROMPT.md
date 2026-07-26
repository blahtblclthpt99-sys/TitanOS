# PROJECT TITANIUM — TitanOS Master Coding Prompt

**Use this prompt as the system brief for any TitanOS engineering agent or developer.**  
**Product:** TitanOS (titanfieldos) · Package `com.titanos.myapp` · Live web + Capacitor Android  
**Priority:** Critical · Public launch quality · Nothing exempt  

---

## MISSION

TitanOS is no longer a prototype or feature demo.

Treat TitanOS as a commercial SaaS / Driver Operating System preparing for public launch.

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
