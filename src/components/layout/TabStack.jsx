/**
 * TitanOS authenticated route stack.
 *
 * Product surface is intentionally limited to four pillars:
 * Business, Find Work, 2nd Self, and Titan Auto + Leads.
 * Essential account/support/admin utilities remain reachable, while retired product
 * routes redirect into the nearest core pillar instead of staying as parallel products.
 */
import React, { Suspense, lazy, useRef } from "react";
import { Navigate, useLocation } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import Spinner from "@/components/shared/Spinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { normalizeAppPath } from "@/lib/routing";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const PageNotFound = lazy(() => import("@/lib/PageNotFound"));

// Four product roots kept warm between switches.
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

// Titan Business workflows.
const Jobs = lazy(() => import("@/pages/Jobs"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const Customers = lazy(() => import("@/pages/Customers"));
const CustomerDetail = lazy(() => import("@/pages/CustomerDetail"));
const Estimates = lazy(() => import("@/pages/Estimates"));
const Invoices = lazy(() => import("@/pages/Invoices"));
const InvoiceDetail = lazy(() => import("@/pages/InvoiceDetail"));
const Payments = lazy(() => import("@/pages/Payments"));

// Internal workflows behind 2nd Self / Titan Auto.
const AIAssistant = lazy(() => import("@/pages/AIAssistant"));
const Leads = lazy(() => import("@/pages/Leads"));
const FollowUps = lazy(() => import("@/pages/FollowUps"));

// Find Work compatibility workflows used by employer-side matching. They are not
// separate product destinations and remain hidden from primary navigation.
const MatchReadyJobPost = lazy(() => import("@/pages/MatchReadyJobPost"));
const WorkerMatches = lazy(() => import("@/pages/WorkerMatches"));
const ExistingPostWorkerMatches = lazy(() => import("@/pages/ExistingPostWorkerMatches"));

// Essential utilities, not product pillars.
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
  // Retired shell/product destinations -> Titan Business.
  "/more": "/",
  "/driver": "/",
  "/routes": "/",
  "/booking": "/",
  "/employees": "/",
  "/fleet": "/",
  "/inventory": "/",
  "/business-documents": "/",
  "/contracts": "/",
  "/insurance": "/",
  "/credentials": "/",
  "/finances": "/",
  "/reports": "/",
  "/tax-center": "/",
  "/analytics": "/",
  "/companies": "/",
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

  // Retired AI aliases -> 2nd Self.
  "/ai-assistant": "/assistant",
  "/growth-coach": "/second-me",
  "/marketing": "/second-me",
  "/phone": "/second-me",

  // Old Hire landing -> current job-seeking pillar.
  "/hire": "/hire/matches",
};

const NON_TAB_ROUTES = {
  // Titan Business
  "/jobs": Jobs,
  "/schedule": Schedule,
  "/customers": Customers,
  "/estimates": Estimates,
  "/invoices": Invoices,
  "/payments": Payments,

  // 2nd Self + Titan Auto internals
  "/assistant": AIAssistant,
  "/leads": Leads,
  "/follow-ups": FollowUps,

  // Find Work internal employer workflows
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

  // Old nested Driver routes are intentionally retired with Driver Hub.
  if (pathname.startsWith("/driver/")) return <Navigate to="/" replace />;

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
