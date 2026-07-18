# TitanOS — Refactor Report

## Created Files

| File | Purpose |
|------|---------|
| src/components/ErrorBoundary.jsx | React error boundary with retry |
| src/components/shared/AppError.jsx | Shared error UI |
| src/components/shared/ErrorState.jsx | Data error wrapper |
| src/components/shared/PageLoader.jsx | Loading skeletons |
| src/components/shared/OfflineIndicator.jsx | Offline banner |
| src/components/shared/SessionExpiryBanner.jsx | JWT expiry warning |
| src/components/shared/VirtualList.jsx | List virtualization |
| src/components/shared/NavBadge.jsx | Nav notification counts |
| src/components/charts/ReportsCharts.jsx | Lazy reports charts |
| src/components/charts/FinancesExpenseChart.jsx | Lazy finances chart |
| src/hooks/useDashboardData.js | Dashboard query + shaping |
| src/hooks/useEntityRecord.js | Single-record query hook |
| src/hooks/useNavBadges.js | Sidebar/mobile badges |
| src/hooks/useOnlineStatus.js | Online/offline detection |
| src/hooks/usePrefetchDashboard.js | Dashboard prefetch |
| src/hooks/useSessionExpiry.js | Session expiry logic |
| src/hooks/useSidebarState.js | Sidebar persist + shortcut |
| src/lib/date-utils.js | date-fns helpers |
| src/lib/entity-query.js | TanStack query keys |
| src/lib/query-client.js | QueryClient config |
| src/lib/jwt-utils.js | JWT expiry parsing |
| src/lib/nav-utils.js | Route active detection |
| src/lib/storage.js | Safe localStorage |
| src/lib/dashboard-queries.js | Shared dashboard descriptors |
| src/lib/finance-metrics.js | Shared financial calculations |

## Modified Files (summary)

**Core:** main.jsx, App.jsx, index.html, index.css, package.json

**Auth/Data:** AuthContext.jsx, ProtectedRoute.jsx, useEntityData.js, usePullToRefresh.js, useProAccess.js

**Layout:** TabStack.jsx, AppLayout.jsx, Sidebar.jsx, MobileNav.jsx, MobileHeader.jsx, PageNotFound.jsx

**Shared:** Spinner.jsx, FormField.jsx, AIGreeting.jsx, FeedbackButton.jsx

**Pages:** Dashboard, Jobs, Customers, Invoices, Estimates, Finances, Reports, Schedule, TaxCenter, Settings, Referral, Insurance, CustomerDetail, InvoiceDetail, Login, Register, ForgotPassword, ResetPassword

## Deleted Files

- src/components/dashboard/RecentJobs.jsx
- src/components/dashboard/RevenueChart.jsx
- src/components/dashboard/StatCard.jsx
- src/components/shared/ToastNotification.jsx
- src/functions/create-checkout.js
- src/hooks/useToast.js
- src/utils/index.ts
- src/entities/MileageTrip.json

## Unchanged (intentional)

- All route URLs
- base44/entities/*.jsonc schemas
- base44/functions/*/entry.ts server functions
- Fleet.jsx and Marketplace.jsx mock data behavior
- Insurance localStorage model

## Dependencies

**Removed:** three, lodash, canvas-confetti, html2canvas, jspdf, react-leaflet, react-quill, moment, @stripe/react-stripe-js, @stripe/stripe-js, @hello-pangea/dnd, react-hot-toast

**Added:** @tanstack/react-virtual
