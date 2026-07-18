import React from "react";
import { FREE_LAUNCH } from "@/lib/plan";
import useProAccess from "@/hooks/useProAccess";

/**
 * Optional feature gate. During FREE_LAUNCH always shows children.
 * Later: set FREE_LAUNCH=false and pass feature=PRO_FEATURES.* to enforce Pro.
 */
export default function ProGate({ feature, children, fallback = null }) {
  const { canAccess, isLoading } = useProAccess();

  if (FREE_LAUNCH) return <>{children}</>;
  if (isLoading) return null;
  if (!canAccess(feature)) return fallback;
  return <>{children}</>;
}
