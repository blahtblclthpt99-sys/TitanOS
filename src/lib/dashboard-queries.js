/** Shared TanStack Query descriptors for dashboard data + prefetch. */
export const DASHBOARD_QUERIES = [
  { entity: "Job", method: "list", args: ["-scheduled_date", 200] },
  { entity: "Invoice", method: "list", args: ["-created_date", 200] },
  { entity: "Estimate", method: "list", args: ["-created_date", 100] },
  { entity: "Customer", method: "list", args: ["-created_date", 200] },
  { entity: "Employee", method: "list", args: ["-created_date", 50] },
];
