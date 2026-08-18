/**
 * TabStack keeps only the four Titan product pillars mounted between switches.
 * Legacy pages remain lazy compatibility routes and do not stay alive in memory.
 */
import React, { Suspense, lazy, useRef } from "react";
import { Navigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import Spinner from "@/components/shared/Spinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { normalizeAppPath } from "@/lib/routing";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const PageNotFound = lazy(() => import("@/lib/PageNotFound"));

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const JobMatches = lazy(() => import("@/pages/JobMatches"));
const SecondMe = lazy(() => import("@/pages/SecondMe"));
const Autopilot = lazy(() => import("@/pages/Autopilot"));

const TAB_PATHS = ["/", "/hire/matches", "/second-me", "/autopilot"];
const TAB_LRU_SIZE = 4;
const TAB_COMPONENTS = {
  "/": Dashboard,
  "/hire/matches": JobMatches,
  "/second-me": SecondMe,
  "/autopilot": Autopilot,
};

// Core business routes.
const Jobs = lazy(() => import("@/pages/Jobs"));
const Customers = lazy(() => import("@/pages/Customers"));
const CustomerDetail = lazy(() => import("@/pages/CustomerDetail"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const Estimates = lazy(() => import("@/pages/Estimates"));
const Invoices = lazy(() => import("@/pages/Invoices"));
const InvoiceDetail = lazy(() => import("@/pages/InvoiceDetail"));
const Payments = lazy(() => import("@/pages/Payments"));

// 2nd Self / Titan Auto internal workflows.
const AIAssistant = lazy(() => import("@/pages/AIAssistant"));
const Leads = lazy(() => import("@/pages/Leads"));
const FollowUps = lazy(() => import("@/pages/FollowUps"));

// Compatibility-only routes. They remain code-split and hidden from primary nav.
const DriverHub = lazy(() => import("@/pages/DriverHub"));
const TitanComms = lazy(() => import("@/pages/TitanComms"));
const Marketplace = lazy(() => import("@/pages/Marketplace"));
const Profile = lazy(() => import("@/pages/Profile"));
const JobEstimator = lazy(() => import("@/pages/JobEstimator"));
const Finances = lazy(() => import("@/pages/Finances"));
const ReceiptScanner = lazy(() => import("@/pages/ReceiptScanner"));
const Fleet = lazy(() => import("@/pages/Fleet"));
const TaxCenter = lazy(() => import("@/pages/TaxCenter"));
const Reports = lazy(() => import("@/pages/Reports"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Insurance = lazy(() => import("@/pages/Insurance"));
const Referral = lazy(() => import("@/pages/Referral"));
const Hire = lazy(() => import("@/pages/Hire"));
const MatchReadyJobPost = lazy(() => import("@/pages/MatchReadyJobPost"));
const WorkerMatches = lazy(() => import("@/pages/WorkerMatches"));
const ExistingPostWorkerMatches = lazy(() => import("@/pages/ExistingPostWorkerMatches"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const AdminModeration = lazy(() => import("@/pages/AdminModeration"));
const AdminFees = lazy(() => import("@/pages/AdminFees"));
const AdminTaxRules = lazy(() => import("@/pages/AdminTaxRules"));
const AdminControlCenter = lazy(() => import("@/pages/AdminControlCenter"));
const Booking = lazy(() => import("@/pages/Booking"));
const Contracts = lazy(() => import("@/pages/Contracts"));
const RoutePlanner = lazy(() => import("@/pages/RoutePlanner"));
const Companies = lazy(() => import("@/pages/Companies"));
const Employees = lazy(() => import("@/pages/Employees"));
const Inventory = lazy(() => import("@/pages/Inventory"));
const Reputation = lazy(() => import("@/pages/Reputation"));
const Credentials = lazy(() => import("@/pages/Credentials"));
const DriverProfile = lazy(() => import("@/pages/DriverProfile"));
const DriverTripDetail = lazy(() => import("@/pages/DriverTripDetail"));
const Settings = lazy(() => import("@/pages/Settings"));
const Subscription = lazy(() => import("@/pages/Subscription"));
const TrustSafety = lazy(() => import("@/pages/TrustSafety"));
const DesignSystem = lazy(() => import("@/pages/DesignSystem"));
const ShareReport = lazy(() => import("@/pages/ShareReport"));
const BusinessDocuments = lazy(() => import("@/pages/BusinessDocuments"));

const LEGACY_REDIRECTS = {
  "/more": "/",
  "/messages": "/comms",
  "/titan-score": "/",
  "/growth-coach": "/second-me",
  "/marketing": "/second-me",
  "/phone": "/second-me",
  "/community": "/",
  "/emergency": "/",
  "/deals": "/",
  "/escrow": "/",
};

const NON_TAB_ROUTES = {
  // Titan Business
  "/jobs": Jobs,
  "/schedule": Schedule,
  "/customers": Customers,
  "/estimates": Estimates,
  "/invoices": Invoices,
  "/payments": Payments,

  // Internal parts of 2nd Self and Titan Auto
  "/assistant": AIAssistant,
  "/leads": Leads,
  "/follow-ups": FollowUps,

  // Compatibility routes
  "/driver": DriverHub,
  "/comms": TitanComms,
  "/job-estimator": JobEstimator,
  "/finances": Finances,
  "/receipts": ReceiptScanner,
  "/fleet": Fleet,
  "/tax-center": TaxCenter,
  "/reports": Reports,
  "/analytics": Analytics,
  "/business-documents": BusinessDocuments,
  "/insurance": Insurance,
  "/referral": Referral,
  "/hire": Hire,
  "/hire/post-match-ready": MatchReadyJobPost,
  "/hire/candidates": WorkerMatches,
  "/hire/find-workers": ExistingPostWorkerMatches,
  "/notifications": Notifications,
  "/admin/moderation": AdminModeration,
  "/admin/fees": AdminFees,
  "/admin/tax-rules": AdminTaxRules,
  "/admin": AdminControlCenter,
  "/booking": Booking,
  "/contracts": Contracts,
  "/routes": RoutePlanner,
  "/companies": Companies,
  "/employees": Employees,
  "/inventory": Inventory,
  "/reputation": Reputation,
  "/credentials": Credentials,
  "/settings": Settings,
  "/subscription": Subscription,
  "/trust-safety": TrustSafety,
  "/design-system": DesignSystem,
  "/profile": Profile,
  "/marketplace": Marketplace,
};

function NonTabPage() {
  const { pathname: rawPath } = useLocation();
  const pathname = normalizeAppPath(rawPath);

  const redirect = LEGACY_REDIRECTS[pathname];
  if (redirect) return <Navigate to={redirect} replace />;

  if (pathname.startsWith("/share/report/")) {
    return (
      <Suspense fallback={<Spinner />}>
        <ShareReport />
      </Suspense>
    );
  }
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
  if (pathname.startsWith("/driver/trip/")) {
    return (
      <Suspense fallback={<Spinner />}>
        <DriverTripDetail />
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
  if (!Page) {
    return (
      <Suspense fallback={<Spinner />}>
        <PageNotFound />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<Spinner />}>
      <Page />
    </Suspense>
  );
}

export default function TabStack() {
  const location = useLocation();
  const recentTabs = useRef(["/"]);
  const pathname = normalizeAppPath(location.pathname);
  const reduceMotion = usePrefersReducedMotion();
  const isTab = TAB_PATHS.includes(pathname);
  const activeTab = isTab ? pathname : null;

  if (activeTab) {
    recentTabs.current = [activeTab, ...recentTabs.current.filter((path) => path !== activeTab)].slice(0, TAB_LRU_SIZE);
  }

  const mountedTabs = new Set(["/", ...recentTabs.current]);
  if (activeTab) mountedTabs.add(activeTab);

  return (
    <div className="relative w-full min-h-[calc(100svh-8rem)]">
      {TAB_PATHS.map((path) => {
        const Page = TAB_COMPONENTS[path];
        const isMounted = mountedTabs.has(path);
        const isActive = activeTab === path;
        if (!isMounted) return null;

        return (
          <div
            key={path}
            style={{ display: isActive ? "block" : "none" }}
            aria-hidden={!isActive}
            className={isActive && !reduceMotion ? "page-enter" : undefined}
          >
            <ErrorBoundary message="This Titan pillar failed to load. Try switching away and back, or refresh.">
              <Suspense fallback={<Spinner label="Loading" />}>
                <Page isActive={isActive} />
              </Suspense>
            </ErrorBoundary>
          </div>
        );
      })}

      {!isTab ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={reduceMotion ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
            transition={{ duration: reduceMotion ? 0 : 0.14, ease: "easeOut" }}
            className="relative w-full"
          >
            <ErrorBoundary key={pathname} message="This page failed to load. Try again or return to Business Home.">
              <NonTabPage />
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      ) : null}
    </div>
  );
}
