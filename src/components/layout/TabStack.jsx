/**
 * TitanOS authenticated route stack.
 *
 * TitanOS is a Business Operating System first. Daily operating routes remain
 * direct product destinations. Growth, matching, and intelligence extend the
 * business OS without displacing jobs, customers, money, people, or fleet.
 */
import React, { Suspense, lazy, useRef } from "react";
import { Navigate, useLocation } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import Spinner from "@/components/shared/Spinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { normalizeAppPath } from "@/lib/routing";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const PageNotFound = lazy(() => import("@/lib/PageNotFound"));

// Business Home remains warm because it is the operating dashboard.
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const TAB_PATHS = ["/"];
const TAB_LRU_SIZE = 1;
const TAB_COMPONENTS = {
  "/": Dashboard,
};

// Core business operations.
const Jobs = lazy(() => import("@/pages/Jobs"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const Customers = lazy(() => import("@/pages/Customers"));
const CustomerDetail = lazy(() => import("@/pages/CustomerDetail"));
const Estimates = lazy(() => import("@/pages/Estimates"));
const Invoices = lazy(() => import("@/pages/Invoices"));
const InvoiceDetail = lazy(() => import("@/pages/InvoiceDetail"));
const Payments = lazy(() => import("@/pages/Payments"));

// Business management.
const Employees = lazy(() => import("@/pages/Employees"));
const Fleet = lazy(() => import("@/pages/Fleet"));
const DriverHub = lazy(() => import("@/pages/DriverHub"));
const RoutePlanner = lazy(() => import("@/pages/RoutePlanner"));
const Inventory = lazy(() => import("@/pages/Inventory"));
const BusinessDocuments = lazy(() => import("@/pages/BusinessDocuments"));
const Credentials = lazy(() => import("@/pages/Credentials"));
const Contracts = lazy(() => import("@/pages/Contracts"));
const Insurance = lazy(() => import("@/pages/Insurance"));
const MoreMenu = lazy(() => import("@/pages/MoreMenu"));

// Business extensions.
const JobMatches = lazy(() => import("@/pages/JobMatches"));
const SecondMe = lazy(() => import("@/pages/SecondMe"));
const Autopilot = lazy(() => import("@/pages/Autopilot"));
const AIAssistant = lazy(() => import("@/pages/AIAssistant"));
const Leads = lazy(() => import("@/pages/Leads"));
const FollowUps = lazy(() => import("@/pages/FollowUps"));

// Employer-side matching workflows.
const MatchReadyJobPost = lazy(() => import("@/pages/MatchReadyJobPost"));
const WorkerMatches = lazy(() => import("@/pages/WorkerMatches"));
const ExistingPostWorkerMatches = lazy(() => import("@/pages/ExistingPostWorkerMatches"));

// Essential utilities.
const Notifications = lazy(() => import("@/pages/Notifications"));
const Profile = lazy(() => import("@/pages/Profile"));
const Settings = lazy(() => import("@/pages/Settings"));
const Subscription = lazy(() => import("@/pages/Subscription"));
const TrustSafety = lazy(() => import("@/pages/TrustSafety"));
const AdminControlCenter = lazy(() => import("@/pages/AdminControlCenter"));
const AdminModeration = lazy(() => import("@/pages/AdminModeration"));
const AdminFees = lazy(() => import("@/pages/AdminFees"));
const AdminTaxRules = lazy(() => import("@/pages/AdminTaxRules"));

const LEGACY_REDIRECTS = {
  // Consolidated or retired business destinations.
  "/booking": "/schedule",
  "/finances": "/invoices",
  "/reports": "/",
  "/tax-center": "/invoices",
  "/analytics": "/",
  "/companies": "/settings",
  "/job-estimator": "/estimates",
  "/receipts": "/invoices",
  "/marketplace": "/",
  "/reputation": "/customers",
  "/referral": "/customers",
  "/comms": "/customers",
  "/messages": "/customers",
  "/titan-score": "/",
  "/community": "/",
  "/emergency": "/",
  "/deals": "/",
  "/escrow": "/",

  // Old AI aliases -> 2nd Self.
  "/ai-assistant": "/assistant",
  "/growth-coach": "/second-me",
  "/marketing": "/second-me",
  "/phone": "/second-me",

  // Old Hire landing -> current matching workspace.
  "/hire": "/hire/matches",
};

const NON_TAB_ROUTES = {
  // Business operations
  "/jobs": Jobs,
  "/schedule": Schedule,
  "/customers": Customers,
  "/estimates": Estimates,
  "/invoices": Invoices,
  "/payments": Payments,

  // Business management
  "/employees": Employees,
  "/fleet": Fleet,
  "/driver": DriverHub,
  "/routes": RoutePlanner,
  "/inventory": Inventory,
  "/business-documents": BusinessDocuments,
  "/credentials": Credentials,
  "/contracts": Contracts,
  "/insurance": Insurance,
  "/more": MoreMenu,

  // Growth & intelligence extensions
  "/hire/matches": JobMatches,
  "/second-me": SecondMe,
  "/autopilot": Autopilot,
  "/assistant": AIAssistant,
  "/leads": Leads,
  "/follow-ups": FollowUps,

  // Employer-side matching internals
  "/hire/post-match-ready": MatchReadyJobPost,
  "/hire/candidates": WorkerMatches,
  "/hire/find-workers": ExistingPostWorkerMatches,

  // Utilities
  "/notifications": Notifications,
  "/profile": Profile,
  "/settings": Settings,
  "/subscription": Subscription,
  "/trust-safety": TrustSafety,
  "/admin": AdminControlCenter,
  "/admin/moderation": AdminModeration,
  "/admin/fees": AdminFees,
  "/admin/tax-rules": AdminTaxRules,
};

function NonTabPage() {
  const { pathname: rawPath } = useLocation();
  const pathname = normalizeAppPath(rawPath);

  const redirect = LEGACY_REDIRECTS[pathname];
  if (redirect) return <Navigate to={redirect} replace />;

  if (pathname.startsWith("/customers/") && pathname !== "/customers") {
    return (
      <Suspense fallback={<Spinner />}>
        <CustomerDetail />
      </Suspense>
    );
  }

  if (pathname.startsWith("/invoices/") && pathname !== "/invoices") {
    return (
      <Suspense fallback={<Spinner />}>
        <InvoiceDetail />
      </Suspense>
    );
  }

  // Driver detail/history routes are no longer a separate consumer operating
  // system. Keep the business-facing fleet workspace as the only Driver entry.
  if (pathname.startsWith("/driver/") && pathname !== "/driver") {
    return <Navigate to="/driver" replace />;
  }

  const Page = NON_TAB_ROUTES[pathname];
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
            <ErrorBoundary message="Titan Business Home failed to load. Try switching away and back, or refresh.">
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
            <ErrorBoundary key={pathname} message="This business workspace failed to load. Try again or return to Business Home.">
              <NonTabPage />
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      ) : null}
    </div>
  );
}
