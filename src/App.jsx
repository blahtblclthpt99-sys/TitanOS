import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { BrowserRouter, HashRouter, Route, Routes, Navigate } from "react-router-dom";
import React, { Suspense, lazy, useEffect } from "react";
import PageNotFound from "./lib/PageNotFound";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import ScrollToTop from "./components/ScrollToTop";
import ProtectedRoute from "@/components/ProtectedRoute";
import Spinner from "@/components/shared/Spinner";
import PathNormalizer from "@/lib/PathNormalizer";
import { shouldUseHashRouter } from "@/lib/routing";

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

/** `/` is marketing for guests and the app shell for signed-in users. */
function RootRoute() {
  const {
    isAuthenticated,
    isLoadingAuth,
    isLoadingPublicSettings,
    authChecked,
    authError,
    checkUserAuth,
  } = useAuth();

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

  if (isAuthenticated) {
    return <AppLayout />;
  }

  return <Landing />;
}

function AuthenticatedApp() {
  return (
    <PathNormalizer>
      <Suspense fallback={<Spinner fullScreen label="Loading page" />}>
        <Routes>
          <Route path="/" element={<RootRoute />} />
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

          <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
            <Route path="/*" element={<AppLayout />} />
          </Route>

          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Suspense>
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
