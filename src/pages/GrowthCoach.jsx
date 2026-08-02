import React from "react";
import { useNavigate } from "react-router";
import { ChevronRight, Sparkles } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import PageShell from "@/components/shared/PageShell";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import FeatureHonestyBanner from "@/components/shared/FeatureHonestyBanner";
import { useEntityData } from "@/hooks/useEntityData";
import { buildWeeklyCoachReport } from "@/lib/growthCoach";

export default function GrowthCoach() {
  const navigate = useNavigate();
  const {
    data: [invoices, expenses, customers, jobs, estimates],
    loading,
    error,
    reload,
  } = useEntityData([
    { entity: "Invoice", method: "list", args: ["-created_date", 100] },
    { entity: "Expense", method: "list", args: ["-created_date", 100] },
    { entity: "Customer", method: "list", args: ["-created_date", 100] },
    { entity: "Job", method: "list", args: ["-created_date", 100] },
    { entity: "Estimate", method: "list", args: ["-created_date", 100] },
  ]);

  if (loading) return <PageLoader variant="list" label="Loading growth tips" />;
  if (error) return <ErrorState title="Couldn't load growth tips" onRetry={reload} />;

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
          {insights.map((insight) => {
            const text = typeof insight === "string" ? insight : insight.text;
            const path = typeof insight === "string" ? "/jobs" : insight.path;
            return (
              <button
                key={text}
                type="button"
                onClick={() => navigate(path)}
                className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-md bg-muted/60 p-4 text-left text-sm text-foreground/90 hover:bg-muted focus-ring"
              >
                <span>{text}</span>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </section>
    </PageShell>
  );
}
