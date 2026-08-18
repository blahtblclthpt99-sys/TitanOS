import React from "react";
import { Navigate, useLocation, useParams } from "react-router";
import { normalizeAppPath } from "@/lib/routing";

/**
 * Legacy Driver Hub profile route.
 *
 * Public worker star ratings/reviews are intentionally retired. Candidate and
 * worker review now flows through the hardened Talent Profile, which presents
 * objective professional information and keeps Engagement as a separate,
 * informational-only signal.
 */
export default function DriverProfile({ forcedDriverId = "" }) {
  const { id: paramId } = useParams();
  const location = useLocation();
  const path = normalizeAppPath(location.pathname);
  const parts = path.split("/").filter(Boolean);
  const pathId = parts[0] === "driver" && parts[1] ? parts[1] : "";
  const workerId = forcedDriverId || paramId || pathId;

  if (!workerId) return <Navigate to="/talent" replace />;
  return <Navigate to={`/talent/worker/${encodeURIComponent(workerId)}`} replace />;
}
