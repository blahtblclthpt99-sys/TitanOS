function currency(value) {
  return (Number(value) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * Build deterministic, server-owned transient UI from already-authorized summary data.
 * The model never emits executable UI code. Actions are navigation or prompts only.
 */
export function buildInvisibleInterface({ question = "", summary = null, pageContext = null } = {}) {
  if (!summary) return null;
  const q = String(question || "").toLowerCase();
  const counts = summary.counts || {};

  if (/owe|outstanding|unpaid|overdue|cash flow|collections/.test(q)) {
    const invoices = Array.isArray(summary.unpaidInvoices) ? summary.unpaidInvoices.slice(0, 8) : [];
    return {
      version: 1,
      type: "checklist",
      title: "Collections focus",
      subtitle: `${currency(summary.outstandingTotal)} outstanding across ${counts.unpaidInvoices || invoices.length || 0} invoice(s).`,
      provenance: "server_snapshot",
      generatedAt: nowIso(),
      items: invoices.length
        ? invoices.map((invoice) => ({
            label: invoice.customer || "Customer",
            value: currency(invoice.amount),
            detail: [invoice.status, invoice.due ? `Due ${invoice.due}` : ""].filter(Boolean).join(" · "),
            status: String(invoice.status || "").toLowerCase() === "overdue" ? "danger" : "warning",
          }))
        : [{ label: "No unpaid invoices in this snapshot", value: currency(summary.outstandingTotal), status: "success" }],
      actions: [
        { kind: "navigate", label: "Open invoices", path: "/invoices" },
        { kind: "prompt", label: "Plan follow-ups", prompt: "Prioritize my unpaid invoices and give me a safe follow-up plan." },
      ],
    };
  }

  if (/today'?s jobs|jobs?.*today|today.*schedule|dispatch|route/.test(q)) {
    const jobs = Array.isArray(summary.todaysJobs) ? summary.todaysJobs.slice(0, 8) : [];
    return {
      version: 1,
      type: "checklist",
      title: "Today's field plan",
      subtitle: `${jobs.length} scheduled job(s) in the current server snapshot.`,
      provenance: "server_snapshot",
      generatedAt: nowIso(),
      items: jobs.length
        ? jobs.map((job) => ({
            label: job.title || "Job",
            value: job.time || job.status || "Scheduled",
            detail: [job.customer, job.status].filter(Boolean).join(" · "),
            status: job.status === "completed" ? "success" : "info",
          }))
        : [{ label: "No jobs scheduled today", value: "Clear", status: "success" }],
      actions: [
        { kind: "navigate", label: "Open jobs", path: "/jobs" },
        { kind: "navigate", label: "Open schedule", path: "/schedule" },
      ],
    };
  }

  if (/profit|margin|revenue|collected|income|financial|money/.test(q)) {
    return {
      version: 1,
      type: "metrics",
      title: "Financial snapshot",
      subtitle: "Bounded server-owned operational totals; open the source screens for complete records.",
      provenance: "server_snapshot",
      generatedAt: nowIso(),
      items: [
        { label: "Collected this month", value: currency(summary.collectedThisMonth), status: "success" },
        { label: "Outstanding AR", value: currency(summary.outstandingTotal), status: Number(summary.outstandingTotal) > 0 ? "warning" : "success" },
        { label: "Expenses this month", value: currency(summary.expensesThisMonth), status: "info" },
        { label: "Net this month", value: currency(summary.netThisMonth), status: Number(summary.netThisMonth) < 0 ? "danger" : "success" },
      ],
      actions: [
        { kind: "navigate", label: "Open reports", path: "/reports" },
        { kind: "navigate", label: "Open finances", path: "/finances" },
      ],
    };
  }

  if (/top customers|best customers|customer summary|customers by revenue/.test(q)) {
    const customers = Array.isArray(summary.topCustomers) ? summary.topCustomers.slice(0, 5) : [];
    return {
      version: 1,
      type: "comparison",
      title: "Top customer snapshot",
      subtitle: "Ranked by lifetime value in the current authorized snapshot.",
      provenance: "server_snapshot",
      generatedAt: nowIso(),
      items: customers.map((customer) => ({
        label: customer.name || "Customer",
        value: currency(customer.value),
        status: "info",
      })),
      actions: [{ kind: "navigate", label: "Open customers", path: "/customers" }],
    };
  }

  if (/what should i do next|success plan|priority|what am i forgetting|open loops/.test(q)) {
    const signal = summary.prioritySignals || {};
    return {
      version: 1,
      type: "decision",
      title: "Next-best action",
      subtitle: signal.headline || "Titan has no urgent operational signal in the current snapshot.",
      provenance: "server_snapshot",
      generatedAt: nowIso(),
      items: [
        { label: "Priority", value: signal.level || "low", detail: signal.nextAction || "Review current work queue.", status: signal.level === "high" ? "danger" : signal.level === "medium" ? "warning" : "success" },
        ...(Array.isArray(signal.focusAreas) ? signal.focusAreas.slice(0, 3).map((area) => ({ label: area, value: "Focus", status: "info" })) : []),
      ],
      actions: [
        { kind: "prompt", label: "Build my plan", prompt: "Turn this priority signal into a short step-by-step plan using only my authorized data." },
      ],
    };
  }

  if (pageContext?.entityType && pageContext?.entityId) {
    return {
      version: 1,
      type: "summary",
      title: pageContext.title || `${pageContext.entityType} context`,
      subtitle: "Titan recognizes the active page context, but will not infer missing entity facts.",
      provenance: "server_snapshot",
      generatedAt: nowIso(),
      items: [
        { label: "Entity", value: pageContext.entityType, status: "info" },
        { label: "Workflow", value: pageContext.workflow || "current", status: "info" },
      ],
      actions: [],
    };
  }

  return null;
}

export function buildConfirmationInterface(confirm) {
  if (!confirm || confirm.type !== "confirm") return null;
  return {
    version: 1,
    type: "decision",
    title: confirm.confirmationSummary || "Confirm Titan action",
    subtitle: "Review before execution. This interface cannot execute by itself.",
    provenance: "server_snapshot",
    generatedAt: nowIso(),
    items: (confirm.confirmationDetails || []).slice(0, 8).map((detail, index) => ({
      label: `Check ${index + 1}`,
      value: String(detail || "").slice(0, 240),
      status: "info",
    })),
    actions: [],
  };
}
