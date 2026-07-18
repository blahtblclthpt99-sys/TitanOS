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
