import React from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/shared/PageHeader";
import PageShell from "@/components/shared/PageShell";
import FeatureHonestyBanner from "@/components/shared/FeatureHonestyBanner";
import ComingSoonState from "@/components/shared/ComingSoonState";
import { Button } from "@/components/ui/button";

export default function LocalDeals() {
  return (
    <PageShell maxWidth="lg">
      <PageHeader
        title="Partner deals"
        subtitle="Negotiated partner rates are not live yet."
        breadcrumbs={[
          { label: "More", to: "/more" },
          { label: "Labs" },
          { label: "Partner deals" },
        ]}
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
      <div className="mt-3 flex flex-wrap gap-2 justify-center">
        <Button asChild variant="outline" className="min-h-[44px]">
          <Link to="/more">Back to More</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-[44px]">
          <Link to="/insurance">Open Insurance</Link>
        </Button>
      </div>
    </PageShell>
  );
}
