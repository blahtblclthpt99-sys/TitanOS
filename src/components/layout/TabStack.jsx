/**
 * TabStack — keeps each primary tab mounted so scroll position + state survive
 * tab switches. Pages are hidden with `display:none` when inactive; only the
 * active one is visible. Non-tab pages (detail screens, settings, etc.) slide
 * in on top via AnimatePresence.
 */
import React, { Suspense, lazy, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Spinner from "@/components/shared/Spinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import PageNotFound from "@/lib/PageNotFound";
import { normalizeAppPath } from "@/lib/routing";

// Tab root paths — these pages stay persistently mounted
const TAB_PATHS = ["/", "/jobs", "/customers", "/invoices", "/more"];

// Lazy-load each tab page
const Dashboard  = lazy(() => import("@/pages/Dashboard"));
const Jobs       = lazy(() => import("@/pages/Jobs"));
const Customers  = lazy(() => import("@/pages/Customers"));
const Invoices   = lazy(() => import("@/pages/Invoices"));
const MoreMenu   = lazy(() => import("@/pages/MoreMenu"));

const TAB_COMPONENTS = {
  "/":           Dashboard,
  "/jobs":       Jobs,
  "/customers":  Customers,
  "/invoices":   Invoices,
  "/more":       MoreMenu,
};

// Non-tab pages — hoisted lazy imports (must not call lazy() during render)
const CustomerDetail = lazy(() => import("@/pages/CustomerDetail"));
const InvoiceDetail  = lazy(() => import("@/pages/InvoiceDetail"));
const Schedule       = lazy(() => import("@/pages/Schedule"));
const Estimates      = lazy(() => import("@/pages/Estimates"));
const Finances       = lazy(() => import("@/pages/Finances"));
const Fleet          = lazy(() => import("@/pages/Fleet"));
const TaxCenter      = lazy(() => import("@/pages/TaxCenter"));
const Reports        = lazy(() => import("@/pages/Reports"));
const Settings       = lazy(() => import("@/pages/Settings"));
const AIAssistant    = lazy(() => import("@/pages/AIAssistant"));
const Marketplace    = lazy(() => import("@/pages/Marketplace"));
const Insurance      = lazy(() => import("@/pages/Insurance"));
const Referral       = lazy(() => import("@/pages/Referral"));

const NON_TAB_ROUTES = {
  "/schedule":    Schedule,
  "/estimates":   Estimates,
  "/finances":    Finances,
  "/fleet":       Fleet,
  "/tax-center":  TaxCenter,
  "/reports":     Reports,
  "/settings":    Settings,
  "/assistant":   AIAssistant,
  "/marketplace": Marketplace,
  "/insurance":   Insurance,
  "/referral":    Referral,
};

function NonTabPage() {
  const { pathname: rawPath } = useLocation();
  const pathname = normalizeAppPath(rawPath);

  if (pathname.startsWith("/customers/")) {
    return (
      <Suspense fallback={<Spinner />}>
        <CustomerDetail />
      </Suspense>
    );
  }
  if (pathname.startsWith("/invoices/")) {
    return (
      <Suspense fallback={<Spinner />}>
        <InvoiceDetail />
      </Suspense>
    );
  }

  // Alias legacy path used in older builds
  const routeKey = pathname === "/ai-assistant" ? "/assistant" : pathname;
  const Page = NON_TAB_ROUTES[routeKey];
  if (!Page) return <PageNotFound />;

  return (
    <Suspense fallback={<Spinner />}>
      <Page />
    </Suspense>
  );
}

export default function TabStack() {
  const location = useLocation();
  const mountedTabs = useRef(new Set());
  const pathname = normalizeAppPath(location.pathname);

  const isTab = TAB_PATHS.includes(pathname);
  const activeTab = isTab ? pathname : null;

  // Once a tab is visited, keep it mounted forever
  if (activeTab) mountedTabs.current.add(activeTab);

  return (
    <ErrorBoundary message="This page failed to load.">
      {/* Persistent tab layers — all mounted, toggled with display */}
      {TAB_PATHS.map((path) => {
        const Page = TAB_COMPONENTS[path];
        const isMounted = mountedTabs.current.has(path);
        const isActive = activeTab === path;

        if (!isMounted) return null;

        return (
          <div
            key={path}
            style={{ display: isActive ? "block" : "none" }}
          >
            <Suspense fallback={<Spinner />}>
              <Page isActive={isActive} />
            </Suspense>
          </div>
        );
      })}

      {/* Non-tab pages slide in on top */}
      {!isTab && (
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <NonTabPage />
          </motion.div>
        </AnimatePresence>
      )}
    </ErrorBoundary>
  );
}
