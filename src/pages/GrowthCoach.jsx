import React from "react";
import { Sparkles } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import PageShell from "@/components/shared/PageShell";
import FeatureHonestyBanner from "@/components/shared/FeatureHonestyBanner";
import { useEntityData } from "@/hooks/useEntityData";
import { buildWeeklyCoachReport } from "@/lib/growthCoach";

export default function GrowthCoach() {
  const {
    data: [invoices, expenses, customers, jobs, estimates],
  } = useEntityData([
    { entity: "Invoice", method: "list", args: ["-created_date", 100] },
    { entity: "Expense", method: "list", args: ["-created_date", 100] },
    { entity: "Customer", method: "list", args: ["-created_date", 100] },
    { entity: "Job", method: "list", args: ["-created_date", 100] },
    { entity: "Estimate", method: "list", args: ["-created_date", 100] },
  ]);
  const insights = buildWeeklyCoachReport({ invoices, expenses, customers, jobs, estimates });

  return (
    <PageShell maxWidth="lg">
      <PageHeader
        eyebrow="Labs · Beta"
        title="Growth Coach"
        subtitle="Rule-based tips from your Jobs, Invoices, and Customers — not a live AI coach."
      />
      <FeatureHonestyBanner>
        These suggestions are simple heuristics on your account data. They are not personalized coaching,
        forecasts, or automated outreach.
      </FeatureHonestyBanner>
      <section className="titan-surface p-5">
        <div className="mb-4 flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
          <h2 className="font-semibold text-foreground">Suggested next moves</h2>
        </div>
        <div className="space-y-3">
          {insights.map((insight) => (
            <p key={insight} className="rounded-md bg-muted/60 p-4 text-sm text-foreground/90">
              {insight}
            </p>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
