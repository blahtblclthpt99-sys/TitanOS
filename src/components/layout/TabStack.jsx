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
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const TAB_PATHS = ["/", "/jobs", "/marketplace", "/messages", "/settings", "/more"];

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Jobs = lazy(() => import("@/pages/Jobs"));
const Customers = lazy(() => import("@/pages/Customers"));
const Invoices = lazy(() => import("@/pages/Invoices"));
const MoreMenu = lazy(() => import("@/pages/MoreMenu"));
const MarketplaceTab = lazy(() => import("@/pages/Marketplace"));
const MessagesTab = lazy(() => import("@/pages/Messages"));
const SettingsTab = lazy(() => import("@/pages/Settings"));
const Community = lazy(() => import("@/pages/Community"));

const TAB_COMPONENTS = {
  "/": Dashboard,
  "/jobs": Jobs,
  "/marketplace": MarketplaceTab,
  "/messages": MessagesTab,
  "/settings": SettingsTab,
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
const Analytics = lazy(() => import("@/pages/Analytics"));
const AIAssistant = lazy(() => import("@/pages/AIAssistant"));
const Insurance = lazy(() => import("@/pages/Insurance"));
const Referral = lazy(() => import("@/pages/Referral"));
const Hire = lazy(() => import("@/pages/Hire"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const JobEstimator = lazy(() => import("@/pages/JobEstimator"));
const AdminModeration = lazy(() => import("@/pages/AdminModeration"));
const Booking = lazy(() => import("@/pages/Booking"));
const Contracts = lazy(() => import("@/pages/Contracts"));
const Payments = lazy(() => import("@/pages/Payments"));
const RoutePlanner = lazy(() => import("@/pages/RoutePlanner"));
const ReceiptScanner = lazy(() => import("@/pages/ReceiptScanner"));
const Companies = lazy(() => import("@/pages/Companies"));
const Employees = lazy(() => import("@/pages/Employees"));
const Inventory = lazy(() => import("@/pages/Inventory"));
const FollowUps = lazy(() => import("@/pages/FollowUps"));
const Reputation = lazy(() => import("@/pages/Reputation"));
const Credentials = lazy(() => import("@/pages/Credentials"));
const Leads = lazy(() => import("@/pages/Leads"));
const GrowthCoach = lazy(() => import("@/pages/GrowthCoach"));
const TitanScore = lazy(() => import("@/pages/TitanScore"));
const MarketingStudio = lazy(() => import("@/pages/MarketingStudio"));
const LocalDeals = lazy(() => import("@/pages/LocalDeals"));
const EmergencyJobs = lazy(() => import("@/pages/EmergencyJobs"));
const Escrow = lazy(() => import("@/pages/Escrow"));
const PhoneReceptionist = lazy(() => import("@/pages/PhoneReceptionist"));
const DriverHub = lazy(() => import("@/pages/DriverHub"));
const DriverProfile = lazy(() => import("@/pages/DriverProfile"));
const Profile = lazy(() => import("@/pages/Profile"));
const TrustSafety = lazy(() => import("@/pages/TrustSafety"));
const DesignSystem = lazy(() => import("@/pages/DesignSystem"));

const NON_TAB_ROUTES = {
  "/schedule": Schedule,
  "/estimates": Estimates,
  "/finances": Finances,
  "/fleet": Fleet,
  "/tax-center": TaxCenter,
  "/reports": Reports,
  "/analytics": Analytics,
  "/customers": Customers,
  "/invoices": Invoices,
  "/assistant": AIAssistant,
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
  "/employees": Employees,
  "/inventory": Inventory,
  "/follow-ups": FollowUps,
  "/reputation": Reputation,
  "/credentials": Credentials,
  "/leads": Leads,
  "/growth-coach": GrowthCoach,
  "/titan-score": TitanScore,
  "/marketing": MarketingStudio,
  "/deals": LocalDeals,
  "/emergency": EmergencyJobs,
  "/escrow": Escrow,
  "/phone": PhoneReceptionist,
  "/driver": DriverHub,
  "/profile": Profile,
  "/trust-safety": TrustSafety,
  "/design-system": DesignSystem,
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
  if (pathname.startsWith("/driver/") && pathname !== "/driver/") {
    return (
      <Suspense fallback={<Spinner />}>
        <DriverProfile />
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
  const reduceMotion = usePrefersReducedMotion();

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
            className={isActive && !reduceMotion ? "page-enter" : undefined}
          >
            <ErrorBoundary message="This tab failed to load. Try switching away and back, or refresh.">
              <Suspense fallback={<Spinner label="Loading" />}>
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
            initial={reduceMotion ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
            transition={{ duration: reduceMotion ? 0 : 0.14, ease: "easeOut" }}
            className="relative w-full"
          >
            {/* key={pathname} remounts the boundary so a crash on Reports can't trap Jobs/Home */}
            <ErrorBoundary key={pathname} message="This page failed to load. Try again or go back to Command Center.">
              <NonTabPage />
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
