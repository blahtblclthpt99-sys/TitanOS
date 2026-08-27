/**
 * TabStack — keeps a small LRU of high-frequency tabs mounted so scroll/state survive
 * nearby switches. Lower-frequency pages render normally and merged legacy routes
 * redirect to their canonical TitanOS destination.
 */
import React, { Suspense, lazy, useRef } from "react";
import { Navigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import Spinner from "@/components/shared/Spinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { normalizeAppPath } from "@/lib/routing";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const PageNotFound = lazy(() => import("@/lib/PageNotFound"));

const TAB_PATHS = ["/", "/driver", "/comms", "/jobs", "/more"];
const TAB_LRU_SIZE = 3;

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Jobs = lazy(() => import("@/pages/Jobs"));
const MoreMenu = lazy(() => import("@/pages/MoreMenu"));
const DriverHubTab = lazy(() => import("@/pages/DriverHub"));
const TitanCommsTab = lazy(() => import("@/pages/TitanComms"));

const TAB_COMPONENTS = {
  "/": Dashboard,
  "/driver": DriverHubTab,
  "/comms": TitanCommsTab,
  "/jobs": Jobs,
  "/more": MoreMenu,
};

const Customers = lazy(() => import("@/pages/Customers"));
const Invoices = lazy(() => import("@/pages/Invoices"));
const Marketplace = lazy(() => import("@/pages/Marketplace"));
const Profile = lazy(() => import("@/pages/Profile"));
const CareerReadiness = lazy(() => import("@/pages/CareerReadiness"));
const CustomerDetail = lazy(() => import("@/pages/CustomerDetail"));
const InvoiceDetail = lazy(() => import("@/pages/InvoiceDetail"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const Estimates = lazy(() => import("@/pages/Estimates"));
const JobEstimator = lazy(() => import("@/pages/JobEstimator"));
const Finances = lazy(() => import("@/pages/Finances"));
const ReceiptScanner = lazy(() => import("@/pages/ReceiptScanner"));
const Fleet = lazy(() => import("@/pages/Fleet"));
const TaxCenter = lazy(() => import("@/pages/TaxCenter"));
const Reports = lazy(() => import("@/pages/Reports"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const AIAssistant = lazy(() => import("@/pages/AIAssistant"));
const Insurance = lazy(() => import("@/pages/Insurance"));
const Referral = lazy(() => import("@/pages/Referral"));
const Hire = lazy(() => import("@/pages/Hire"));
const JobMatches = lazy(() => import("@/pages/JobMatches"));
const CareerPipeline = lazy(() => import("@/pages/CareerPipeline"));
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
const Payments = lazy(() => import("@/pages/Payments"));
const RoutePlanner = lazy(() => import("@/pages/RoutePlanner"));
const Companies = lazy(() => import("@/pages/Companies"));
const Employees = lazy(() => import("@/pages/Employees"));
const Inventory = lazy(() => import("@/pages/Inventory"));
const FollowUps = lazy(() => import("@/pages/FollowUps"));
const Autopilot = lazy(() => import("@/pages/Autopilot"));
const Reputation = lazy(() => import("@/pages/Reputation"));
const Credentials = lazy(() => import("@/pages/Credentials"));
const Leads = lazy(() => import("@/pages/Leads"));
const DriverProfile = lazy(() => import("@/pages/DriverProfile"));
const DriverTripDetail = lazy(() => import("@/pages/DriverTripDetail"));
const Settings = lazy(() => import("@/pages/Settings"));
const Subscription = lazy(() => import("@/pages/Subscription"));
const TrustSafety = lazy(() => import("@/pages/TrustSafety"));
const DesignSystem = lazy(() => import("@/pages/DesignSystem"));
const ShareReport = lazy(() => import("@/pages/ShareReport"));
const BusinessDocuments = lazy(() => import("@/pages/BusinessDocuments"));
const SecondMe = lazy(() => import("@/pages/SecondMe"));

const LEGACY_REDIRECTS = {
  "/messages": "/comms",
  "/titan-score": "/analytics?titanScore=1",
  "/growth-coach": "/assistant?mode=growth",
  "/marketing": "/assistant?mode=marketing",
  "/phone": "/assistant?mode=phone-script",
  "/community": "/",
  "/emergency": "/",
  "/deals": "/",
  "/escrow": "/",
};

const NON_TAB_ROUTES = {
  "/schedule": Schedule,
  "/estimates": Estimates,
  "/job-estimator": JobEstimator,
  "/finances": Finances,
  "/receipts": ReceiptScanner,
  "/fleet": Fleet,
  "/tax-center": TaxCenter,
  "/reports": Reports,
  "/analytics": Analytics,
  "/customers": Customers,
  "/invoices": Invoices,
  "/assistant": AIAssistant,
  "/second-me": SecondMe,
  "/business-documents": BusinessDocuments,
  "/insurance": Insurance,
  "/referral": Referral,
  "/hire": Hire,
  "/hire/matches": JobMatches,
  "/career/pipeline": CareerPipeline,
  "/career/readiness": CareerReadiness,
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
  "/payments": Payments,
  "/routes": RoutePlanner,
  "/companies": Companies,
  "/employees": Employees,
  "/inventory": Inventory,
  "/follow-ups": FollowUps,
  "/autopilot": Autopilot,
  "/reputation": Reputation,
  "/credentials": Credentials,
  "/leads": Leads,
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

  if (pathname.startsWith("/share/report/")) return <Suspense fallback={<Spinner />}><ShareReport /></Suspense>;
  if (pathname.startsWith("/customers/")) return <Suspense fallback={<Spinner />}><CustomerDetail /></Suspense>;
  if (pathname.startsWith("/invoices/")) return <Suspense fallback={<Spinner />}><InvoiceDetail /></Suspense>;
  if (pathname.startsWith("/driver/trip/")) return <Suspense fallback={<Spinner />}><DriverTripDetail /></Suspense>;
  if (pathname.startsWith("/driver/") && pathname !== "/driver/") return <Suspense fallback={<Spinner />}><DriverProfile /></Suspense>;

  const routeKey = pathname === "/ai-assistant" ? "/assistant" : pathname;
  const Page = NON_TAB_ROUTES[routeKey];
  if (!Page) return <Suspense fallback={<Spinner />}><PageNotFound /></Suspense>;
  return <Suspense fallback={<Spinner />}><Page /></Suspense>;
}

export default function TabStack() {
  const location = useLocation();
  const recentTabs = useRef(["/"]);
  const pathname = normalizeAppPath(location.pathname);
  const reduceMotion = usePrefersReducedMotion();
  const isTab = TAB_PATHS.includes(pathname);
  const activeTab = isTab ? pathname : null;

  if (activeTab) recentTabs.current = [activeTab, ...recentTabs.current.filter((p) => p !== activeTab)].slice(0, TAB_LRU_SIZE);
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
          <div key={path} style={{ display: isActive ? "block" : "none" }} aria-hidden={!isActive} className={isActive && !reduceMotion ? "page-enter" : undefined}>
            <ErrorBoundary message="This tab failed to load. Try switching away and back, or refresh.">
              <Suspense fallback={<Spinner label="Loading" />}><Page isActive={isActive} /></Suspense>
            </ErrorBoundary>
          </div>
        );
      })}

      {!isTab && (
        <AnimatePresence mode="wait">
          <motion.div key={pathname} initial={reduceMotion ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }} transition={{ duration: reduceMotion ? 0 : 0.14, ease: "easeOut" }} className="relative w-full">
            <ErrorBoundary key={pathname} message="This page failed to load. Try again or go back to Home."><NonTabPage /></ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
