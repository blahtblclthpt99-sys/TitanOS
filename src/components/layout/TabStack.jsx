/**
 * TabStack — keeps each primary tab mounted so scroll position + state survive
 * tab switches. Pages are hidden with `display:none` when inactive.
 * Non-tab pages (Reports, Assistant, etc.) render in normal document flow so
 * they keep a real height (absolute overlays collapse when all tabs are hidden).
 */
import React, { Suspense, lazy, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Spinner from "@/components/shared/Spinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import PageNotFound from "@/lib/PageNotFound";
import { normalizeAppPath } from "@/lib/routing";

const TAB_PATHS = ["/", "/jobs", "/customers", "/invoices", "/more"];

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Jobs = lazy(() => import("@/pages/Jobs"));
const Customers = lazy(() => import("@/pages/Customers"));
const Invoices = lazy(() => import("@/pages/Invoices"));
const MoreMenu = lazy(() => import("@/pages/MoreMenu"));

const TAB_COMPONENTS = {
  "/": Dashboard,
  "/jobs": Jobs,
  "/customers": Customers,
  "/invoices": Invoices,
  "/more": MoreMenu,
};

const CustomerDetail = lazy(() => import("@/pages/CustomerDetail"));
const InvoiceDetail = lazy(() => import("@/pages/InvoiceDetail"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const Estimates = lazy(() => import("@/pages/Estimates"));
const Finances = lazy(() => import("@/pages/Finances"));
const Fleet = lazy(() => import("@/pages/Fleet"));
const TaxCenter = lazy(() => import("@/pages/TaxCenter"));
const Reports = lazy(() => import("@/pages/Reports"));
const Settings = lazy(() => import("@/pages/Settings"));
const AIAssistant = lazy(() => import("@/pages/AIAssistant"));
const Marketplace = lazy(() => import("@/pages/Marketplace"));
const Insurance = lazy(() => import("@/pages/Insurance"));
const Referral = lazy(() => import("@/pages/Referral"));
const Hire = lazy(() => import("@/pages/Hire"));
const Community = lazy(() => import("@/pages/Community"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const JobEstimator = lazy(() => import("@/pages/JobEstimator"));
const AdminModeration = lazy(() => import("@/pages/AdminModeration"));
const Booking = lazy(() => import("@/pages/Booking"));
const Contracts = lazy(() => import("@/pages/Contracts"));
const Payments = lazy(() => import("@/pages/Payments"));
const RoutePlanner = lazy(() => import("@/pages/RoutePlanner"));
const ReceiptScanner = lazy(() => import("@/pages/ReceiptScanner"));
const Companies = lazy(() => import("@/pages/Companies"));

const NON_TAB_ROUTES = {
  "/schedule": Schedule,
  "/estimates": Estimates,
  "/finances": Finances,
  "/fleet": Fleet,
  "/tax-center": TaxCenter,
  "/reports": Reports,
  "/settings": Settings,
  "/assistant": AIAssistant,
  "/marketplace": Marketplace,
  "/insurance": Insurance,
  "/referral": Referral,
  "/hire": Hire,
  "/community": Community,
  "/notifications": Notifications,
  "/job-estimator": JobEstimator,
  "/admin/moderation": AdminModeration,
  "/booking": Booking,
  "/contracts": Contracts,
  "/payments": Payments,
  "/routes": RoutePlanner,
  "/receipts": ReceiptScanner,
  "/companies": Companies,
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
  const mountedTabs = useRef(new Set(["/"]));
  const pathname = normalizeAppPath(location.pathname);

  const isTab = TAB_PATHS.includes(pathname);
  const activeTab = isTab ? pathname : null;

  if (activeTab) mountedTabs.current.add(activeTab);

  return (
    <div className="relative w-full min-h-[calc(100svh-8rem)]">
      {TAB_PATHS.map((path) => {
        const Page = TAB_COMPONENTS[path];
        const isMounted = mountedTabs.current.has(path);
        const isActive = activeTab === path;

        if (!isMounted) return null;

        return (
          <div
            key={path}
            style={{ display: isActive ? "block" : "none" }}
            aria-hidden={!isActive}
          >
            <ErrorBoundary message="This tab failed to load.">
              <Suspense fallback={<Spinner />}>
                <Page isActive={isActive} />
              </Suspense>
            </ErrorBoundary>
          </div>
        );
      })}

      {!isTab && (
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="relative w-full"
          >
            {/* key={pathname} remounts the boundary so a crash on Reports can't trap Jobs/Home */}
            <ErrorBoundary key={pathname} message="This page failed to load.">
              <NonTabPage />
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
