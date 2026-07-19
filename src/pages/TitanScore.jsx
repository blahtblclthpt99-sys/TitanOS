import React from "react";
import { Award, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/shared/PageHeader";
import { useEntityData } from "@/hooks/useEntityData";
import { computeTitanScore } from "@/lib/titanScore";

export default function TitanScore() {
  const navigate = useNavigate();
  const { data: [invoices, jobs, customers, estimates, reviews] } = useEntityData([
    { entity: "Invoice", method: "list", args: ["-created_date", 200] },
    { entity: "Job", method: "list", args: ["-created_date", 200] },
    { entity: "Customer", method: "list", args: ["-created_date", 200] },
    { entity: "Estimate", method: "list", args: ["-created_date", 200] },
    { entity: "JobReview", method: "list", args: ["-created_date", 100] },
  ]);
  const result = computeTitanScore({ invoices, jobs, customers, estimates, reviews });

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-28">
      <PageHeader title="Titan Score" subtitle="Your business credit-style health score" />
      <div className="glass rounded-3xl p-6 md:p-8 border border-primary/20 mb-5 flex flex-col sm:flex-row gap-6 items-center">
        <div className="w-36 h-36 rounded-full border-4 border-primary flex flex-col items-center justify-center shadow-lift bg-primary/10">
          <p className="text-4xl font-bold text-foreground">{result.score}</p>
          <p className="text-sm font-semibold text-primary">{result.grade}</p>
        </div>
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
            <Award className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Business health</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Built from revenue, job completion, payment reliability, reviews, estimate wins, and loyalty signals.
          </p>
          <p className="text-sm text-foreground mt-3">
            ${result.revenue.toLocaleString()} collected · {result.stats.completedJobs} jobs done · {result.stats.reviewAvg}★ avg
          </p>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        {Object.entries(result.breakdown).map(([key, pts]) => (
          <div key={key} className="glass rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground capitalize">{key}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{pts}</p>
          </div>
        ))}
      </div>
      <section className="glass rounded-2xl p-5">
        <h3 className="font-semibold text-foreground mb-3">How to improve</h3>
        <div className="space-y-2">
          {result.tips.map((tip) => (
            <button
              key={tip}
              type="button"
              onClick={() => navigate("/invoices")}
              className="w-full text-left rounded-xl bg-muted/60 hover:bg-muted px-4 py-3 text-sm text-foreground flex items-center justify-between gap-3"
            >
              <span>{tip}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
