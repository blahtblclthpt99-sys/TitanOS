/**
 * TitanOS authenticated route stack.
 *
 * Two account experiences share auth, safety, TitanAUTO and support:
 * - Business accounts get the Business Operating System and recruiting.
 * - Job seekers get nearby job matching and a professional matching profile.
 */
import React, { Suspense, lazy, useRef } from "react";
import { Navigate, useLocation } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import Spinner from "@/components/shared/Spinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { normalizeAppPath } from "@/lib/routing";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useAuth } from "@/lib/AuthContext";
import { accountHomePath, isBusinessAccount } from "@/lib/accountExperience";

const PageNotFound = lazy(() => import("@/lib/PageNotFound"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));

// Business operations.
const Jobs = lazy(() => import("@/pages/Jobs"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const Customers = lazy(() => import("@/pages/Customers"));
const CustomerDetail = lazy(() => import("@/pages/CustomerDetail"));
const Estimates = lazy(() => import("@/pages/Estimates"));
const Invoices = lazy(() => import("@/pages/Invoices"));
const InvoiceDetail = lazy(() => import("@/pages/InvoiceDetail"));
const Payments = lazy(() => import("@/pages/Payments"));

// Business management + recruiting.
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
const MatchReadyJobPost = lazy(() => import("@/pages/MatchReadyJobPost"));
const WorkerMatches = lazy(() => import("@/pages/WorkerMatches"));
const ExistingPostWorkerMatches = lazy(() => import("@/pages/ExistingPostWorkerMatches"));
const TalentProfile = lazy(() => import("@/pages/TalentProfile"));

// Job seeker.
const JobMatches = lazy(() => import("@/pages/JobMatches"));
const JobSeekerProfile = lazy(() => import("@/pages/JobSeekerProfile"));

// Shared Titan layer.
const Autopilot = lazy(() => import("@/pages/Autopilot"));
const SecondMe = lazy(() => import("@/pages/SecondMe"));
const AIAssistant = lazy(() => import("@/pages/AIAssistant"));
const Leads = lazy(() => import("@/pages/Leads"));
const FollowUps = lazy(() => import("@/pages/FollowUps"));

// Utilities.
const Notifications = lazy(() => import("@/pages/Notifications"));
const Profile = lazy(() => import("@/pages/Profile"));
const Settings = lazy(() => import("@/pages/Settings"));
const Subscription = lazy(() => import("@/pages/Subscription"));
const TrustSafety = lazy(() => import("@/pages/TrustSafety"));
const AccountType = lazy(() => import("@/pages/AccountType"));
const AdminControlCenter = lazy(() => import("@/pages/AdminControlCenter"));
const AdminModeration = lazy(() => import("@/pages/AdminModeration"));
const AdminFees = lazy(() => import("@/pages/AdminFees"));
const AdminTaxRules = lazy(() => import("@/pages/AdminTaxRules"));

const TAB_PATHS = ["/"];
const TAB_LRU_SIZE = 1;
const TAB_COMPONENTS = { "/": Dashboard };

const BUSINESS_ONLY_PREFIXES = [
  "/jobs",
  "/schedule",
  "/customers",
  "/estimates",
  "/invoices",
  "/payments",
  "/employees",
  "/talent",
  "/fleet",
  "/driver",
  "/routes",
  "/inventory",
  "/business-documents",
  "/credentials",
  "/contracts",
  "/insurance",
  "/more",
  "/hire/candidates",
  "/hire/find-workers",
  "/hire/post-match-ready",
];

const SEEKER_ONLY_PREFIXES = ["/hire/matches", "/job-profile"];

const LEGACY_REDIRECTS = {
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
  "/ai-assistant": "/assistant",
  "/growth-coach": "/second-me",
  "/marketing": "/second-me",
  "/phone": "/second-me",
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

  // Business management and recruiting
  "/employees": Employees,
  "/talent": ExistingPostWorkerMatches,
  "/fleet": Fleet,
  "/driver": DriverHub,
  "/routes": RoutePlanner,
  "/inventory": Inventory,
  "/business-documents": BusinessDocuments,
  "/credentials": Credentials,
  "/contracts": Contracts,
  "/insurance": Insurance,
  "/more": MoreMenu,
  "/hire/post-match-ready": MatchReadyJobPost,
  "/hire/candidates": WorkerMatches,
  "/hire/find-workers": ExistingPostWorkerMatches,

  // Job seeker
  "/hire/matches": JobMatches,
  "/job-profile": JobSeekerProfile,

  // Shared Titan layer
  "/autopilot": Autopilot,
  "/second-me": SecondMe,
  "/assistant": AIAssistant,
  "/leads": Leads,
  "/follow-ups": FollowUps,

  // Utilities
  "/notifications": Notifications,
  "/profile": Profile,
  "/settings": Settings,
  "/subscription": Subscription,
  "/trust-safety": TrustSafety,
  "/account-type": AccountType,
  "/admin": AdminControlCenter,
  "/admin/moderation": AdminModeration,
  "/admin/fees": AdminFees,
  "/admin/tax-rules": AdminTaxRules,
};

function startsWithAny(pathname, prefixes) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function NonTabPage() {
  const { pathname: rawPath } = useLocation();
  const { user } = useAuth();
  const pathname = normalizeAppPath(rawPath);
  const business = isBusinessAccount(user);

  const redirect = LEGACY_REDIRECTS[pathname];
  if (redirect) return <Navigate to={redirect} replace />;

  if (business && startsWithAny(pathname, SEEKER_ONLY_PREFIXES)) {
    return <Navigate to="/talent" replace />;
  }
  if (!business && startsWithAny(pathname, BUSINESS_ONLY_PREFIXES)) {
    return <Navigate to="/hire/matches" replace />;
  }

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

  if (business && pathname.startsWith("/talent/worker/")) {
    return (
      <Suspense fallback={<Spinner />}>
        <TalentProfile />
      </Suspense>
    );
  }

  // Old driver detail URLs now resolve through the business Talent workspace.
  if (pathname.startsWith("/driver/") && pathname !== "/driver") {
    const workerId = pathname.split("/").filter(Boolean)[1];
    return business && workerId
      ? <Navigate to={`/talent/worker/${encodeURIComponent(workerId)}`} replace />
      : <Navigate to={accountHomePath(user)} replace />;
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
  const { user } = useAuth();
  const location = useLocation();
  const recentTabs = useRef(["/"]);
  const pathname = normalizeAppPath(location.pathname);
  const reduceMotion = usePrefersReducedMotion();
  const business = isBusinessAccount(user);

  if (!business && pathname === "/") {
    return <Navigate to="/hire/matches" replace />;
  }

  const isTab = business && TAB_PATHS.includes(pathname);
  const activeTab = isTab ? pathname : null;

  if (activeTab) {
    recentTabs.current = [activeTab, ...recentTabs.current.filter((path) => path !== activeTab)].slice(0, TAB_LRU_SIZE);
  }

  const mountedTabs = new Set(["/", ...recentTabs.current]);
  if (activeTab) mountedTabs.add(activeTab);

  return (
    <div className="relative w-full min-h-[calc(100svh-8rem)]">
      {business ? TAB_PATHS.map((path) => {
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
      }) : null}

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
            <ErrorBoundary key={pathname} message="This Titan workspace failed to load. Try again or return to your account home.">
              <NonTabPage />
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      ) : null}
    </div>
  );
}
