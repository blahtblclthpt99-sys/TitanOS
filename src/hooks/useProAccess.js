import { useAuth } from "@/lib/AuthContext";
import { FREE_LAUNCH, canAccessFeature, resolvePlan } from "@/lib/plan";

/**
 * Plan / entitlement hook.
 * During FREE_LAUNCH every authenticated user can access all features.
 * `isPro` still reflects the real profiles.is_pro flag for future upsells.
 */
export default function useProAccess() {
  const { user, isLoadingAuth, authChecked } = useAuth();
  const plan = resolvePlan(user);
  const isPro = plan === "pro";
  const isLoading = !authChecked || isLoadingAuth;

  return {
    plan,
    isPro,
    isFreeLaunch: FREE_LAUNCH,
    isLoading,
    canAccess: (featureKey) => canAccessFeature(user, featureKey),
  };
}
