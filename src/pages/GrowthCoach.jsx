import React from "react";
import { Sparkles } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { useEntityData } from "@/hooks/useEntityData";
import { buildWeeklyCoachReport } from "@/lib/growthCoach";
export default function GrowthCoach() {
  const { data: [invoices, expenses, customers, jobs, estimates] } = useEntityData([{ entity: "Invoice", method: "list", args: ["-created_date", 100] }, { entity: "Expense", method: "list", args: ["-created_date", 100] }, { entity: "Customer", method: "list", args: ["-created_date", 100] }, { entity: "Job", method: "list", args: ["-created_date", 100] }, { entity: "Estimate", method: "list", args: ["-created_date", 100] }]);
  const insights = buildWeeklyCoachReport({ invoices, expenses, customers, jobs, estimates });
  return <div className="p-4 md:p-8 max-w-5xl mx-auto"><PageHeader title="Growth Coach" subtitle="Weekly actions based on your live business data" /><section className="glass rounded-2xl p-5"><div className="flex gap-2 text-titan-cyan mb-4"><Sparkles /><h2 className="font-semibold">Your next best moves</h2></div><div className="space-y-3">{insights.map((insight) => <p key={insight} className="rounded-xl bg-white/[.04] p-4 text-foreground/90">{insight}</p>)}</div></section></div>;
}
