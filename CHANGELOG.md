# TitanOS — Production Refactor Changelog

All notable improvements from the production refactor. Functionality, routes, API contracts, and Base44 entities/server functions are preserved unless noted as a bug fix.

## Phase 1 — Critical Stability

- Added root and in-app ErrorBoundary components with retry UI
- Created AppError and ErrorState for consistent error presentation
- TabStack hoists lazy imports; authenticated 404 uses PageNotFound
- ProtectedRoute waits for public settings before redirecting
- Memoized AuthContext; withRetry on auth; logout redirect support
- Fixed stale closure in usePullToRefresh
- Removed unused deps: three, lodash, canvas-confetti, html2canvas, jspdf, react-leaflet, react-quill

## Phase 2 — UX & Accessibility

- Enabled pinch-zoom in index.html
- PageLoader variants; standardized loading/error states
- Spinner ARIA attributes; FormField label wiring
- MobileNav ARIA tab roles; MobileHeader back button label
- Auth errors use role=alert; semantic dashboard buttons

## Phase 3 — Performance & Data Layer

- useEntityData rewritten with TanStack Query (60s staleTime)
- useDashboardData, usePrefetchDashboard, entity-query.js, query-client.js
- Tab pages skip fetch when inactive (isActive prop)
- Replaced moment with date-fns via date-utils.js
- OfflineIndicator, SessionExpiryBanner, useSidebarState (persist + Ctrl+B)
- Lazy ReportsCharts and FinancesExpenseChart
- useAuth() dedup across Settings, Referral, AIGreeting, FeedbackButton, useProAccess

## Phase 4 — Virtualization & Badges

- VirtualList with @tanstack/react-virtual (threshold 25) on Jobs, Customers, Invoices, Estimates
- useNavBadges on Sidebar and MobileNav
- Removed dead dashboard components and duplicate create-checkout.js

## Final Production Pass

- Fixed Insurance.jsx toast API (Radix toast)
- Fixed Customers.jsx form error shadowing query error state
- Extracted dashboard-queries.js and finance-metrics.js
- Created useEntityRecord; migrated CustomerDetail and InvoiceDetail
- Removed useToast.js, utils/index.ts, MileageTrip.json
- Removed @stripe/*, @hello-pangea/dnd, react-hot-toast from package.json

## 1.4.9 — Business Command Center & Grow tools

See `release/PLAY_RELEASE_NOTES.txt` for the Google Play “What’s new” copy.

- Home dashboard redesign with drag-and-drop widgets
- Expanded Home “For you” clips reel (tips + featured marketplace ads)
- Titan Score, AI Marketing, Loyalty, Local Deals, Emergency Jobs
- Payment Protection (escrow), Phone Receptionist, Voice commands
- Smart Schedule tips and brand booking URL
- Dark charcoal theme and collapsible sidebar / Quick Create

## 1.5.0 — Final ~33% Business OS depth

See `supabase/migrations/010_phase100.sql`.

- Customer Portal: accept/decline estimates, pay invoices, leave reviews
- Branded booking host resolve (`slug.titanos.app` → `/book/slug`)
- Full AI estimate builder (line items + market range + plain-English prompt)
- Route Planner provider optimize (Mapbox when keyed) + local fallback
- Receipt vision OCR API hook (OpenAI when keyed)
- GPS check-in geofence + job site map embed
- Contract canvas e-sign + signature image audit fields
- Insurance docs synced to Supabase (migrates legacy localStorage)
- Follow-up Email send via Resend (stub without key)
- Leads CSV import; Reports cohorts + CSV export
- Lead entity mapping fixed (`Lead` → `leads`)

## Money & time focus — Business Timeline + AI leverage

- **Business Timeline** on Home + Customer detail (jobs, estimates, invoices, payments, messages, files)
- **AI Job Summary** on Complete (report + follow-up draft + maintenance tip)
- **AI Price Optimizer** (ZIP, season, competition, job size) in Job Estimator
- **Business Health** Titan Score widget on Command Center
- **Executable Titan AI** actions: schedule job / create estimate / create invoice
- **Service Templates** trade packs (10 trades) under Field & team
- Before/after **Share** on job photos
- Migration `011_job_summaries.sql` for completion summary columns

## 1.5.0 (Play AAB 15) — Production readiness + settlement fix

- Payment Checkout now embeds `invoice_id` / `payment_id` for webhook settlement
- Webhook handles expired/failed payment events; refuses unverified bodies
- Health probe (`/api/functions/health`); ops load/backup/outage harnesses
- See `PRODUCTION_READINESS.md` — storm load PASS at 500 concurrent
- Android `versionCode` **15** / `versionName` **1.5.0**
