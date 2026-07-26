/**
 * Column maps for common TitanOS modules — use with ExportMenu / runExport.
 */

function customerName(c) {
  if (!c) return "";
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return name || c.company_name || c.email || "Customer";
}

export function jobsExportSpec(jobs = []) {
  return {
    id: "jobs",
    title: "Jobs",
    subtitle: "Job list export",
    filename: "titanos-jobs",
    columns: [
      { label: "Title", value: (r) => r.title || "" },
      { label: "Customer", value: (r) => r.customer_name || "" },
      { label: "Status", value: (r) => r.status || "" },
      { label: "Priority", value: (r) => r.priority || "" },
      { label: "Scheduled", value: (r) => r.scheduled_date || "" },
      { label: "Amount", value: (r) => r.amount ?? "" },
      { label: "Address", value: (r) => r.address || "" },
      { label: "Id", value: (r) => r.id || "" },
    ],
    getRows: () => jobs,
  };
}

export function customersExportSpec(customers = []) {
  return {
    id: "customers",
    title: "Customers",
    subtitle: "Customer directory export",
    filename: "titanos-customers",
    columns: [
      { label: "Name", value: (r) => customerName(r) },
      { label: "Email", value: (r) => r.email || "" },
      { label: "Phone", value: (r) => r.phone || "" },
      { label: "Company", value: (r) => r.company_name || "" },
      { label: "Status", value: (r) => r.status || "" },
      { label: "Id", value: (r) => r.id || "" },
    ],
    getRows: () => customers,
  };
}

export function invoicesExportSpec(invoices = []) {
  return {
    id: "invoices",
    title: "Invoices",
    subtitle: "Invoice list export",
    filename: "titanos-invoices",
    columns: [
      { label: "Number", value: (r) => r.invoice_number || r.id },
      { label: "Customer", value: (r) => r.customer_name || "" },
      { label: "Status", value: (r) => r.status || "" },
      { label: "Total", value: (r) => r.total ?? "" },
      { label: "Balance", value: (r) => r.balance_due ?? "" },
      { label: "Due", value: (r) => r.due_date || "" },
      { label: "Created", value: (r) => String(r.created_date || r.created_at || "").slice(0, 10) },
    ],
    getRows: () => invoices,
  };
}

export function expensesExportSpec(expenses = []) {
  return {
    id: "expenses",
    title: "Expenses",
    subtitle: "Expense / receipt export",
    filename: "titanos-expenses",
    columns: [
      { label: "Date", value: (r) => r.date || "" },
      { label: "Vendor", value: (r) => r.vendor || "" },
      { label: "Category", value: (r) => r.category || "" },
      { label: "Amount", value: (r) => r.amount ?? "" },
      { label: "Description", value: (r) => r.description || "" },
      { label: "Deductible", value: (r) => (r.is_tax_deductible ? "yes" : "no") },
    ],
    getRows: () => expenses,
  };
}

export function financesExportSpec(invoices = [], expenses = []) {
  const paid = invoices.filter((i) => i.status === "paid");
  return {
    id: "finances",
    title: "Finances",
    subtitle: "Paid invoices + expenses",
    filename: "titanos-finances",
    columns: [
      { label: "Type", value: (r) => r._type },
      { label: "Date", value: (r) => r._date },
      { label: "Party", value: (r) => r._party },
      { label: "Category", value: (r) => r._category },
      { label: "Amount", value: (r) => r._amount },
    ],
    getRows: () => [
      ...paid.map((r) => ({
        _type: "invoice",
        _date: String(r.paid_at || r.created_date || "").slice(0, 10),
        _party: r.customer_name || "",
        _category: r.status,
        _amount: r.total ?? 0,
      })),
      ...expenses.map((r) => ({
        _type: "expense",
        _date: r.date || "",
        _party: r.vendor || "",
        _category: r.category || "",
        _amount: -(Number(r.amount) || 0),
      })),
    ],
    sheets: undefined, // filled in runExport default; override below via getter pattern in page
  };
}

export function analyticsExportSpec(dashboard) {
  const kpis = dashboard?.kpis || dashboard?.cards || [];
  const activity = dashboard?.activitySeries || [];
  return {
    id: "analytics",
    title: "Analytics",
    subtitle: "KPI snapshot",
    filename: "titanos-analytics",
    columns: [
      { label: "Metric", value: (r) => r.label || r.name || "" },
      { label: "Value", value: (r) => r.value ?? r.display ?? "" },
      { label: "Hint", value: (r) => r.hint || r.subtitle || "" },
    ],
    getRows: () => {
      if (Array.isArray(kpis) && kpis.length) return kpis;
      // Fallback flatten activity series summary
      return activity.map((d) => ({ label: d.label || d.date, value: d.value, hint: "activity" }));
    },
  };
}

export function reportsPackSpec({ paidInvoices = [], expenses = [], jobs = [], cohorts = [] } = {}) {
  const invCols = [
    { label: "Invoice", value: (r) => r.invoice_number || r.id },
    { label: "Customer", value: (r) => r.customer_name || "" },
    { label: "Total", value: (r) => r.total || 0 },
    { label: "Date", value: (r) => String(r.created_date || "").slice(0, 10) },
  ];
  return {
    id: "reports",
    title: "Business Reports",
    subtitle: "Revenue, expenses, jobs, cohorts",
    filename: "titanos-reports",
    columns: invCols,
    getRows: () => paidInvoices,
    sheets: [
      {
        name: "Revenue",
        rows: [
          invCols.map((c) => c.label),
          ...paidInvoices.map((r) => invCols.map((c) => c.value(r))),
        ],
      },
      {
        name: "Expenses",
        rows: [
          ["Date", "Vendor", "Category", "Amount"],
          ...expenses.map((e) => [e.date || "", e.vendor || "", e.category || "", e.amount ?? 0]),
        ],
      },
      {
        name: "Jobs",
        rows: [
          ["Title", "Customer", "Status", "Amount", "Scheduled"],
          ...jobs.map((j) => [j.title || "", j.customer_name || "", j.status || "", j.amount ?? "", j.scheduled_date || ""]),
        ],
      },
      {
        name: "Cohorts",
        rows: [
          ["Month", "Customers", "Paying", "Revenue", "Conversion%"],
          ...cohorts.map((c) => [c.month, c.customers, c.paying, c.revenue, c.conversion]),
        ],
      },
    ],
  };
}

export function estimatesExportSpec(estimates = []) {
  return {
    id: "estimates",
    title: "Estimates",
    subtitle: "Estimate list export",
    filename: "titanos-estimates",
    columns: [
      { label: "Number", value: (r) => r.estimate_number || r.id || "" },
      { label: "Customer", value: (r) => r.customer_name || "" },
      { label: "Status", value: (r) => r.status || "" },
      { label: "Total", value: (r) => r.total ?? "" },
      { label: "Valid until", value: (r) => r.valid_until || r.expiry_date || "" },
      { label: "Created", value: (r) => String(r.created_date || r.created_at || "").slice(0, 10) },
    ],
    getRows: () => estimates,
  };
}

export function leadsExportSpec(leads = []) {
  return {
    id: "leads",
    title: "Leads",
    subtitle: "Lead pipeline export",
    filename: "titanos-leads",
    columns: [
      { label: "Name", value: (r) => r.name || r.full_name || "" },
      { label: "Email", value: (r) => r.email || "" },
      { label: "Phone", value: (r) => r.phone || "" },
      { label: "Status", value: (r) => r.status || r.stage || "" },
      { label: "Source", value: (r) => r.source || "" },
      { label: "Created", value: (r) => String(r.created_date || r.created_at || "").slice(0, 10) },
    ],
    getRows: () => leads,
  };
}

export function paymentsExportSpec(payments = []) {
  return {
    id: "payments",
    title: "Payments",
    subtitle: "Payment list export",
    filename: "titanos-payments",
    columns: [
      { label: "Customer", value: (r) => r.customer_name || "" },
      { label: "Amount", value: (r) => r.amount ?? r.total ?? "" },
      { label: "Status", value: (r) => r.status || "" },
      { label: "Method", value: (r) => r.method || r.provider || "" },
      { label: "Created", value: (r) => String(r.created_date || r.created_at || "").slice(0, 10) },
      { label: "Id", value: (r) => r.id || "" },
    ],
    getRows: () => payments,
  };
}

export function contractsExportSpec(contracts = []) {
  return {
    id: "contracts",
    title: "Contracts",
    subtitle: "Contract list export",
    filename: "titanos-contracts",
    columns: [
      { label: "Title", value: (r) => r.title || r.name || "" },
      { label: "Customer", value: (r) => r.customer_name || "" },
      { label: "Status", value: (r) => r.status || "" },
      { label: "Signed", value: (r) => r.signed_at || "" },
      { label: "Created", value: (r) => String(r.created_date || r.created_at || "").slice(0, 10) },
      { label: "Id", value: (r) => r.id || "" },
    ],
    getRows: () => contracts,
  };
}

/** Tax Center — paid invoices + deductible expenses for a tax year (via finances layout). */
export function taxCenterExportSpec(paidInvoices = [], yearExpenses = []) {
  const base = financesExportSpec(paidInvoices, yearExpenses);
  return {
    ...base,
    id: "tax-center",
    title: "1099 Tax Center",
    subtitle: "Paid revenue and expenses for tax year",
    filename: "titanos-tax-center",
  };
}
