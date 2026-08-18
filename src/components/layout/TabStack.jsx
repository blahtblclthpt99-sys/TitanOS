/**
 * TitanOS authenticated route stack.
 *
 * Isolated workspaces share auth, safety, TitanAUTO and support:
 * - Business: full Business Operating System + recruiting/teams/fleet.
 * - Independent Work: opportunities + lightweight customers/work/quotes/money.
 * - Job Seeker: employment discovery + professional matching profile.
 */
import React, { Suspense, lazy, useRef } from "react";
import { Navigate, useLocation } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import Spinner from "@/components/shared/Spinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { normalizeAppPath } from "@/lib/routing";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useAuth } from "@/lib/AuthContext";
import { accountHomePath, activeWorkspace, WORKSPACES } from "@/lib/accountExperience";

const PageNotFound = lazy(() => import("@/lib/PageNotFound"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));

// Shared operating primitives used by Business and Independent Work.
const Jobs = lazy(() => import("@/pages/Jobs"));
const Customers = lazy(() => import("@/pages/Customers"));
const CustomerDetail = lazy(() => import("@/pages/CustomerDetail"));
const Estimates = lazy(() => import("@/pages/Estimates"));
const Invoices = lazy(() => import("@/pages/Invoices"));
const InvoiceDetail = lazy(() => import("@/pages/InvoiceDetail"));
const Payments = lazy(() => import("@/pages/Payments"));

// Business-only operations and management.
const Schedule = lazy(() => import("@/pages/Schedule"));
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
const ServiceTalentProfile = lazy(() => import("@/pages/ServiceTalentProfile"));

// Independent Work.
const IndependentHome = lazy(() => import("@/pages/IndependentHome"));
const WorkOpportunities = lazy(() => import("@/pages/WorkOpportunities"));
const ServiceProfile = lazy(() => import("@/pages/ServiceProfile"));

// Job seeker.
const JobMatches = lazy(() => import("@/pages/JobMatches"));
const JobSeekerProfile = lazy(() => import("@/pages/JobSeekerProfile"));

// Shared Titan layer.
const Autopilot = lazy(() => import("@/pages/Autopilot"));
const SecondMe = lazy(() => import("@/pages/SecondMe"));
const AIAssistant = lazy(() => import("@/pages/AIAssistant"));
const Leads = lazy(() => import("@/pages/Leads"));
const FollowUps = lazy(() => import("@/pages/FollowUps"));

// Utilities / transparency.
const Notifications = lazy(() => import("@/pages/Notifications"));
const Profile = lazy(() => import("@/pages/Profile"));
const Settings = lazy(() => import("@/pages/Settings"));
const Subscription = lazy(() => import("@/pages/Subscription"));
const TrustSafety = lazy(() => import("@/pages/TrustSafety"));
const Engagement = lazy(() => import("@/pages/Engagement"));
const AccountType = lazy(() => import("@/pages/AccountType"));
const AdminControlCenter = lazy(() => import("@/pages/AdminControlCenter"));
const AdminModeration = lazy(() => import("@/pages/AdminModeration"));
const AdminFees = lazy(() => import("@/pages/AdminFees"));
const AdminTaxRules = lazy(() => import("@/pages/AdminTaxRules"));

const TAB_PATHS = ["/"];
const TAB_LRU_SIZE = 1;
const TAB_COMPONENTS = { "/": Dashboard };

const LIGHTWEIGHT_OS_PREFIXES = [
  "/jobs",
  "/customers",
  "/estimates",
  "/invoices",
  "/payments",
];

const BUSINESS_ONLY_PREFIXES = [
  "/schedule",
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

const INDEPENDENT_ONLY_PREFIXES = ["/independent", "/work-opportunities", "/service-profile"];
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
};

const NON_TAB_ROUTES = {
  // Shared operating primitives for Business + Independent Work.
  "/jobs": Jobs,
  "/customers": Customers,
  "/estimates": Estimates,
  "/invoices": Invoices,
  "/payments": Payments,

  // Business only.
  "/schedule": Schedule,
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

  // Independent Work.
  "/independent": IndependentHome,
  "/work-opportunities": WorkOpportunities,
  "/service-profile": ServiceProfile,

  // Job seeker.
  "/hire/matches": JobMatches,
  "/job-profile": JobSeekerProfile,

  // Shared Titan layer.
  "/autopilot": Autopilot,
  "/second-me": SecondMe,
  "/assistant": AIAssistant,
  "/leads": Leads,
  "/follow-ups": FollowUps,

  // Utilities / transparency.
  "/notifications": Notifications,
  "/profile": Profile,
  "/settings": Settings,
  "/subscription": Subscription,
  "/trust-safety": TrustSafety,
  "/engagement": Engagement,
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
  const workspace = activeWorkspace(user);
  const business = workspace === WORKSPACES.BUSINESS;
  const independent = workspace === WORKSPACES.SELF_EMPLOYED;
  const seeker = workspace === WORKSPACES.JOB_SEEKER;

  if (pathname === "/hire") {
    return <Navigate to={business ? "/talent" : independent ? "/work-opportunities" : "/hire/matches"} replace />;
  }

  const redirect = LEGACY_REDIRECTS[pathname];
  if (redirect) return <Navigate to={redirect} replace />;

  if (business && (startsWithAny(pathname, SEEKER_ONLY_PREFIXES) || startsWithAny(pathname, INDEPENDENT_ONLY_PREFIXES))) {
    return <Navigate to="/" replace />;
  }
  if (independent && (startsWithAny(pathname, SEEKER_ONLY_PREFIXES) || startsWithAny(pathname, BUSINESS_ONLY_PREFIXES))) {
    return <Navigate to="/independent" replace />;
  }
  if (seeker && (
    startsWithAny(pathname, BUSINESS_ONLY_PREFIXES) ||
    startsWithAny(pathname, INDEPENDENT_ONLY_PREFIXES) ||
    startsWithAny(pathname, LIGHTWEIGHT_OS_PREFIXES)
  )) {
    return <Navigate to="/hire/matches" replace />;
  }

  if ((business || independent) && pathname.startsWith("/customers/") && pathname !== "/customers") {
    return (
      <Suspense fallback={<Spinner />}>
        <CustomerDetail />
      </Suspense>
    );
  }

  if ((business || independent) && pathname.startsWith("/invoices/") && pathname !== "/invoices") {
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

  if (business && pathname.startsWith("/talent/service/")) {
    return (
      <Suspense fallback={<Spinner />}>
        <ServiceTalentProfile />
      </Suspense>
    );
  }

  // Old driver detail URLs resolve through Business Talent only.
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
  const workspace = activeWorkspace(user);
  const business = workspace === WORKSPACES.BUSINESS;

  if (!business && pathname === "/") {
    return <Navigate to={accountHomePath(user)} replace />;
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
