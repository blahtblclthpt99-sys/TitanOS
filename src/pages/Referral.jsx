import React from "react";
import { Gift } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { isFeatureEnabled } from "@/lib/featureFlags";
import ReferralProgram from "@/pages/ReferralProgram";

/**
 * Referral program is paused for now. Flip `referrals` feature flag to restore the live UI.
 * Deep links to /referral still resolve honestly instead of 404.
 */
export default function Referral() {
  if (isFeatureEnabled("referrals")) {
    return <ReferralProgram />;
  }

  return (
    <div className="page-pad mx-auto max-w-2xl pb-28 md:pb-10">
      <PageHeader title="Referrals" subtitle="Program paused" />
      <EmptyState
        icon={Gift}
        title="Referral program is paused"
        description="We’re not accepting or rewarding referrals right now. Existing accounts are unaffected — check back later when the program returns."
        actionTo="/settings"
        actionLabel="Back to Settings"
        secondaryTo="/pricing"
        secondaryLabel="View plans"
      />
    </div>
  );
}
