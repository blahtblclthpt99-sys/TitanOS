/**
 * Jobs-first application routing.
 * Keep the employment tools reachable and do not mount legacy dispatch,
 * advertising, billing or unrelated business workflows.
 */
import React, { Suspense, lazy } from "react";
import { Navigate, useLocation } from "react-router";
import Spinner from "@/components/shared/Spinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { normalizeAppPath } from "@/lib/routing";

const CareerHome = lazy(() => import("@/pages/CareerHome"));
const Hire = lazy(() => import("@/pages/Hire"));
const JobMatches = lazy(() => import("@/pages/JobMatches"));
const ResumeBuilder = lazy(() => import("@/pages/ResumeBuilder"));
const MoreMenu = lazy(() => import("@/pages/MoreMenu"));
const Profile = lazy(() => import("@/pages/Profile"));
const CareerCoach = lazy(() => import("@/pages/CareerCoach"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const Settings = lazy(() => import("@/pages/Settings"));

const CAREER_ROUTES = {
  "/": CareerHome,
  "/hire": Hire,
  "/hire/matches": JobMatches,
  "/resume": ResumeBuilder,
  "/more": MoreMenu,
  "/profile": Profile,
  "/assistant": CareerCoach,
  "/notifications": Notifications,
  "/settings": Settings,
};

// Existing bookmarks continue to land somewhere useful without restoring
// the advertising, dispatch, or invoicing surfaces.
const JOB_REDIRECTS = {
  "/jobs": "/hire",
  "/driver": "/hire",
  "/driver/": "/hire",
  "/driver/profile": "/profile",
  "/driver/trip": "/hire",
  "/comms": "/assistant",
  "/job-search": "/hire",
  "/applications": "/hire?tab=applications",
  "/saved-jobs": "/hire?tab=saved",
  "/resume-builder": "/resume",
  "/hire/post-match-ready": "/hire?tab=post",
  "/hire/candidates": "/hire?tab=posts",
  "/hire/find-workers": "/hire?tab=posts",
};

export default function TabStack() {
  const location = useLocation();
  const path = normalizeAppPath(location.pathname);
  const redirect = JOB_REDIRECTS[path];
  if (redirect) return <Navigate to={redirect} replace />;

  const Page = CAREER_ROUTES[path];
  if (!Page) return <Navigate to="/" replace />;

  return <ErrorBoundary message="This career tool could not be loaded. Return home and try again." showHome>
    <Suspense fallback={<Spinner label="Loading career tools" />}>
      <Page />
    </Suspense>
  </ErrorBoundary>;
}
