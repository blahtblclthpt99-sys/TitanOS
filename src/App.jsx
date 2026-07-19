import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { BrowserRouter, HashRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import React, { Suspense, lazy, useEffect } from "react";
import PageNotFound from "./lib/PageNotFound";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import ScrollToTop from "./components/ScrollToTop";
import Spinner from "@/components/shared/Spinner";
import PathNormalizer from "./lib/PathNormalizer";
import { normalizeAppPath, shouldUseHashRouter } from "@/lib/routing";
import { usePrefetchDashboard } from "@/hooks/usePrefetchDashboard";
import { resolveBookingSlugFromHost } from "@/lib/bookingSubdomain";

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import AuthCallback from "@/pages/AuthCallback";
import AppLayout from "@/components/layout/AppLayout";
import Landing from "@/pages/Landing";

const Pricing = lazy(() => import("@/pages/Pricing"));
const Beta = lazy(() => import("@/pages/Beta"));
const Download = lazy(() => import("@/pages/Download"));
const FeatureDetail = lazy(() => import("@/pages/FeatureDetail"));
const ThankYou = lazy(() => import("@/pages/ThankYou"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const CustomerPortal = lazy(() => import("@/pages/CustomerPortal"));

const PublicBooking = lazy(() => import("@/pages/PublicBooking"));
const PublicSign = lazy(() => import("@/pages/PublicSign"));

/** Marketing + auth screens that must not use the app shell. */
const PUBLIC_EXACT = new Set([
  "/pricing",
  "/download",
  "/beta",
  "/thank-you",
  "/privacy-policy",
  "/privacy",
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
  if (p.startsWith("/book/")) return true;
  if (p.startsWith("/sign/")) return true;
  return false;
}

/**
 * One AppLayout instance for every authenticated app route (including `/`).
 * Previously `/` used RootRoute's AppLayout and `/reports` used a different
 * ProtectedRoute AppLayout — so Home remounted the shell while other tabs
 * stayed trapped if a More-menu page crashed.
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

  usePrefetchDashboard(isAuthenticated && authChecked);

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingPublicSettings || isLoadingAuth || !authChecked) {
    return <Spinner fullScreen label="Loading TitanOS" />;
  }

  if (authError?.type === "user_not_registered") {
    return <Navigate to="/login" replace />;
  }

  const pathname = normalizeAppPath(location.pathname);
  const publicPath = isPublicPath(pathname);

  if (isAuthenticated && !publicPath) {
    return <AppLayout />;
  }

  if (!isAuthenticated && !publicPath && pathname !== "/") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <Suspense fallback={<Spinner fullScreen label="Loading page" />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/download" element={<Download />} />
        <Route path="/features/:slug" element={<FeatureDetail />} />
        <Route path="/beta" element={<Beta />} />
        <Route path="/thank-you" element={<ThankYou />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/portal" element={<CustomerPortal />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/book/:slug" element={<PublicBooking />} />
        <Route path="/sign/:token" element={<PublicSign />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
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
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
