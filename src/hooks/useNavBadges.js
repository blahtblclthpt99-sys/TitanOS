import { useMemo } from "react";
import { useEntityData } from "@/hooks/useEntityData";

/**
 * Nav badges via status-filtered queries — not full list downloads.
 */
export function useNavBadges(enabled = true) {
  const { data: [overdueInvoices, pendingEstimates, activeJobs] } = useEntityData(
    [
      { entity: "Invoice", method: "filter", args: [{ status: "overdue" }, "-created_date", 50, 0, ["id", "status"]] },
      {
        entity: "Estimate",
        method: "filter",
        args: [{ status: { in: ["sent", "viewed"] } }, "-created_date", 50, 0, ["id", "status"]],
      },
      {
        entity: "Job",
        method: "filter",
        args: [{ status: "in_progress" }, "-scheduled_date", 50, 0, ["id", "status"]],
      },
    ],
    { enabled }
  );

  return useMemo(() => {
    const overdue = overdueInvoices.length;
    const pending = pendingEstimates.length;
    const active = activeJobs.length;

    return {
      "/": overdue + pending,
      "/jobs": active,
      "/invoices": overdue,
      "/estimates": pending,
    };
  }, [overdueInvoices, pendingEstimates, activeJobs]);
}
