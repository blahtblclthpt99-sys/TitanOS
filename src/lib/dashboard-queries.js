/** Shared TanStack Query descriptors for dashboard data + prefetch.
 * Column lists match Command Center widgets — avoids hauling photos/checklists/line_items.
 * Limits are intentionally lower than full list pages (those use their own queries).
 */

export const DASHBOARD_JOB_COLUMNS =
  "id,title,status,scheduled_date,scheduled_time,amount,customer_name,assigned_name,created_at";

export const DASHBOARD_INVOICE_COLUMNS =
  "id,status,customer_name,total,balance_due,due_date,paid_at,invoice_number,created_at";

export const DASHBOARD_ESTIMATE_COLUMNS =
  "id,status,customer_name,total,valid_until,created_at";

export const DASHBOARD_CUSTOMER_COLUMNS =
  "id,first_name,last_name,email,phone,status,created_at";

export const DASHBOARD_EMPLOYEE_COLUMNS = "id,name,status,created_at";

export const DASHBOARD_QUERIES = [
  { entity: "Job", method: "list", args: ["-scheduled_date", 80, undefined, DASHBOARD_JOB_COLUMNS] },
  { entity: "Invoice", method: "list", args: ["-created_date", 80, undefined, DASHBOARD_INVOICE_COLUMNS] },
  { entity: "Estimate", method: "list", args: ["-created_date", 50, undefined, DASHBOARD_ESTIMATE_COLUMNS] },
  { entity: "Customer", method: "list", args: ["-created_date", 50, undefined, DASHBOARD_CUSTOMER_COLUMNS] },
  { entity: "Employee", method: "list", args: ["-created_date", 50, undefined, DASHBOARD_EMPLOYEE_COLUMNS] },
];
