import { BrowserRouter, HashRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import React, { Suspense, lazy, useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import ScrollToTop from "./components/ScrollToTop";
import Spinner from "@/components/shared/Spinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import DeferredToaster from "./components/DeferredToaster";
import PathNormalizer from "./lib/PathNormalizer";
import { normalizeAppPath, shouldUseHashRouter } from "@/lib/routing";
import { resolveBookingSlugFromHost } from "@/lib/bookingSubdomain";
import { hasCachedAuthSession } from "@/lib/sessionPeek";
import { rememberReturnTo } from "@/lib/returnTo";
import ConfigMissingBanner from "@/components/shared/ConfigMissingBanner";

/** Marketing home — keep in main graph for fast FCP (no framer-motion / radix). */
import Landing from "@/pages/Landing";

const PageNotFound = lazy(() => import("./lib/PageNotFound"));
const AuthenticatedShell = lazy(() => import("./AuthenticatedShell"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const AuthCallback = lazy(() => import("@/pages/AuthCallback"));
const Pricing = lazy(() => import("@/pages/Pricing"));
const Beta = lazy(() => import("@/pages/Beta"));
const Download = lazy(() => import("@/pages/Download"));
const FeatureDetail = lazy(() => import("@/pages/FeatureDetail"));
const FreeTools = lazy(() => import("@/pages/FreeTools"));
const IndustryLanding = lazy(() => import("@/pages/IndustryLanding"));
const DriverBeta = lazy(() => import("@/pages/DriverBeta"));
const ThankYou = lazy(() => import("@/pages/ThankYou"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("@/pages/TermsOfService"));
const CustomerPortal = lazy(() => import("@/pages/CustomerPortal"));
const PublicBooking = lazy(() => import("@/pages/PublicBooking"));
const PublicProfile = lazy(() => import("@/pages/PublicProfile"));
const PublicSign = lazy(() => import("@/pages/PublicSign"));
const ShareReport = lazy(() => import("@/pages/ShareReport"));

/** Marketing + auth screens that must not use the app shell. */
const PUBLIC_EXACT = new Set([
  "/pricing",
  "/download",
  "/free-tools",
  "/beta",
  "/driver-beta",
  "/thank-you",
  "/privacy-policy",
  "/privacy",
  "/terms",
  "/terms-of-service",
  "/portal",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
]);

function isPublicPath(pathname) {
  const p = normalizeAppPath(pathname);
  if (PUBLIC_EXACT.has(p)) return true;
  if (p.startsWith("/features/")) return true;
  if (p.startsWith("/industries/")) return true;
  if (p.startsWith("/book/")) return true;
  if (p.startsWith("/u/")) return true;
  if (p.startsWith("/sign/")) return true;
  if (p.startsWith("/share/report/")) return true;
  return false;
}

function PublicRoutes() {
  return (
    <ErrorBoundary message="This page failed to load. Try refresh or go home." fullScreen showHome>
      <Suspense fallback={<Spinner fullScreen label="Loading page" />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/download" element={<Download />} />
          <Route path="/features/:slug" element={<FeatureDetail />} />
          <Route path="/free-tools" element={<FreeTools />} />
          <Route path="/industries/:slug" element={<IndustryLanding />} />
          <Route path="/beta" element={<Beta />} />
          <Route path="/driver-beta" element={<DriverBeta />} />
          <Route path="/thank-you" element={<ThankYou />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/portal" element={<CustomerPortal />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/book/:slug" element={<PublicBooking />} />
          <Route path="/u/:username" element={<PublicProfile />} />
          <Route path="/sign/:token" element={<PublicSign />} />
          <Route path="/share/report/:token" element={<ShareReport />} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

/**
 * One AppLayout instance for every authenticated app route (including `/`).
 * Public/marketing routes paint immediately without waiting on auth.
 */
function AppShellGate() {
  const location = useLocation();
  const {
    isAuthenticated,
    isLoadingAuth,
    isLoadingPublicSettings,
    authChecked,
    authError,
    checkUserAuth,
  } = useAuth();

  const pathname = normalizeAppPath(location.pathname);
  const publicPath = isPublicPath(pathname);
  const isHome = pathname === "/";
  const nativeRoot = shouldUseHashRouter() && isHome;
  // Re-check on every render so post-login navigation sees the new session immediately.
  const cachedSession = hasCachedAuthSession();

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  // Soft session on app routes: stay on spinner / shell — never bounce to /login
  // (that redirect was looping Login ↔ `/`).
  useEffect(() => {
    if (!cachedSession || isAuthenticated || isLoadingAuth || publicPath) return;
    if (!authChecked) return;
    const t = setTimeout(() => {
      checkUserAuth().catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [cachedSession, isAuthenticated, isLoadingAuth, authChecked, publicPath, checkUserAuth]);

  // Authenticated shell for app routes (and home when signed in / session present)
  const wantsAppShell =
    (isAuthenticated && !publicPath) ||
    (isAuthenticated && isHome) ||
    (cachedSession && (isHome || !publicPath)) ||
    nativeRoot;

  if (wantsAppShell) {
    if (authError?.type === "user_not_registered") {
      return <Navigate to="/login" replace />;
    }
    if (!isAuthenticated || isLoadingAuth || isLoadingPublicSettings || !authChecked) {
      return <Spinner fullScreen label="Loading TitanOS" />;
    }
    return (
      <Suspense fallback={<Spinner fullScreen label="Loading app" />}>
        <ErrorBoundary message="The app shell failed to load. Try refresh." fullScreen showHome>
          <AuthenticatedShell />
        </ErrorBoundary>
      </Suspense>
    );
  }

  // Public marketing / auth — paint immediately (no auth spinner)
  // Home (`/`) is Landing only on the web; native `/` should enter the app flow.
  if ((!nativeRoot && isHome) || publicPath) {
    return <PublicRoutes />;
  }

  // Protected deep-link while auth resolves
  if (!authChecked || isLoadingAuth || isLoadingPublicSettings) {
    return <Spinner fullScreen label="Loading TitanOS" />;
  }

  if (authError?.type === "user_not_registered") {
    return <Navigate to="/login" replace />;
  }

  if (!isAuthenticated) {
    rememberReturnTo(location);
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <Suspense fallback={<Spinner fullScreen label="Loading app" />}>
      <AuthenticatedShell />
    </Suspense>
  );
}

function AuthenticatedApp() {
  const location = useLocation();
  const bookingSlug = resolveBookingSlugFromHost(
    typeof window !== "undefined" ? window.location.hostname : ""
  );
  if (
    bookingSlug &&
    !normalizeAppPath(location.pathname).startsWith("/book/")
  ) {
    return <Navigate to={`/book/${bookingSlug}`} replace />;
  }

  return (
    <PathNormalizer>
      <AppShellGate />
    </PathNormalizer>
  );
}

function App() {
  const Router = shouldUseHashRouter() ? HashRouter : BrowserRouter;

  return (
    <AuthProvider>
      <ConfigMissingBanner />
      <Router>
        <ScrollToTop />
        <AuthenticatedApp />
      </Router>
      <DeferredToaster />
    </AuthProvider>
  );
}

export default App;
