import React from "react";
import PageHeader from "@/components/shared/PageHeader";
import PageShell from "@/components/shared/PageShell";
import FeatureHonestyBanner from "@/components/shared/FeatureHonestyBanner";
import ComingSoonState from "@/components/shared/ComingSoonState";

export default function LocalDeals() {
  return (
    <PageShell maxWidth="lg">
      <PageHeader
        eyebrow="Labs · Coming soon"
        title="Partner deals"
        subtitle="Negotiated partner rates are not live yet."
      />
      <FeatureHonestyBanner>
        TitanOS does not currently offer coupons, affiliate checkout, or negotiated partner pricing. When
        partner deals launch, they will appear here with verified offers.
      </FeatureHonestyBanner>
      <ComingSoonState
        title="Partner deals coming soon"
        description="We removed placeholder offer cards so nothing looks like a live discount. Use Marketplace and Insurance records for real business tools today."
        primaryTo="/marketplace"
        primaryLabel="Open Marketplace"
      />
    </PageShell>
  );
}
