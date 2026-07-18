import { useMemo } from "react";
import { useEntityData } from "@/hooks/useEntityData";

export function useNavBadges(enabled = true) {
  const { data: [invoices, estimates, jobs] } = useEntityData([
    { entity: "Invoice", method: "list", args: ["-created_date", 100] },
    { entity: "Estimate", method: "list", args: ["-created_date", 100] },
    { entity: "Job", method: "list", args: ["-scheduled_date", 100] },
  ], { enabled });

  return useMemo(() => {
    const overdueInvoices = invoices.filter((i) => i.status === "overdue").length;
    const pendingEstimates = estimates.filter((e) =>
      ["sent", "viewed"].includes(e.status)
    ).length;
    const activeJobs = jobs.filter((j) => j.status === "in_progress").length;

    return {
      "/": overdueInvoices + pendingEstimates,
      "/jobs": activeJobs,
      "/invoices": overdueInvoices,
      "/estimates": pendingEstimates,
    };
  }, [invoices, estimates, jobs]);
}
