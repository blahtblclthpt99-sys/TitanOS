function currency(value) {
  return (Number(value) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function nowIso() {
  return new Date().toISOString();
}

function form(title, subtitle, fields, promptTemplate, label = "Continue") {
  return {
    version: 2,
    type: "form",
    title,
    subtitle,
    provenance: "general",
    generatedAt: nowIso(),
    fields,
    items: [],
    actions: [{ kind: "submit_prompt", label, promptTemplate }],
  };
}

/**
 * Build deterministic, server-owned transient UI. Generated UI is data-only:
 * no HTML, code, fetch URLs or direct mutations. Form submissions return to the
 * assistant as a prompt and therefore still pass through intent detection,
 * confirmation, authorization and server-side execution guardrails.
 */
export function buildInvisibleInterface({ question = "", summary = null, pageContext = null } = {}) {
  const q = String(question || "").toLowerCase();

  if (/schedule\s+(a\s+)?job|book\s+(a\s+)?job|new\s+job/.test(q)) {
    return form(
      "Schedule a job",
      "Give me the minimum details. I’ll turn this into a reviewable action before anything is saved.",
      [
        { name: "customer", label: "Customer", type: "text", required: true, placeholder: "Customer name" },
        { name: "date", label: "Date", type: "date", required: true },
        { name: "time", label: "Time", type: "text", required: false, placeholder: "Optional time" },
        { name: "service", label: "What are we doing?", type: "text", required: true, placeholder: "Service or job description" },
      ],
      "Schedule a job for {customer} on {date} at {time} for {service}.",
      "Review job"
    );
  }

  if (/create\s+(an?\s+)?estimate|draft\s+(an?\s+)?estimate/.test(q)) {
    return form(
      "Create an estimate",
      "I’ll collect the missing details first, then show you the action for approval.",
      [
        { name: "customer", label: "Customer", type: "text", required: true, placeholder: "Customer name" },
        { name: "work", label: "Work", type: "textarea", required: true, placeholder: "Describe the work" },
        { name: "amount", label: "Estimated total", type: "number", required: false, placeholder: "Optional amount" },
      ],
      "Create an estimate for {customer} for {work}. Estimated total {amount}.",
      "Review estimate"
    );
  }

  if (/create\s+(an?\s+)?invoice|send\s+(an?\s+)?invoice|bill\s+/.test(q)) {
    return form(
      "Create an invoice",
      "Fill in what you know. Nothing is sent or saved until the normal confirmation step.",
      [
        { name: "customer", label: "Customer", type: "text", required: true, placeholder: "Customer name" },
        { name: "amount", label: "Amount", type: "number", required: true, placeholder: "0.00" },
        { name: "work", label: "What is this for?", type: "textarea", required: false, placeholder: "Optional description" },
      ],
      "Create an invoice for {customer} for {amount} for {work}.",
      "Review invoice"
    );
  }

  if (/add\s+(a\s+)?customer|create\s+(a\s+)?customer|new\s+customer/.test(q)) {
    return form(
      "Add a customer",
      "I’ll use only the details you provide and ask for confirmation before creating the record.",
      [
        { name: "name", label: "Name", type: "text", required: true, placeholder: "Customer name" },
        { name: "email", label: "Email", type: "text", required: false, placeholder: "Optional email" },
        { name: "phone", label: "Phone", type: "text", required: false, placeholder: "Optional phone" },
      ],
      "Create a customer named {name}, email {email}, phone {phone}.",
      "Review customer"
    );
  }

  if (/record\s+(an?\s+)?expense|add\s+(an?\s+)?expense|log\s+(an?\s+)?expense/.test(q)) {
    return form(
      "Record an expense",
      "Capture the facts first. I’ll show the record for approval before saving it.",
      [
        { name: "amount", label: "Amount", type: "number", required: true, placeholder: "0.00" },
        { name: "category", label: "Category", type: "select", required: true, options: ["fuel", "parking", "tolls", "meals", "insurance", "repairs", "maintenance", "supplies", "software", "phone", "advertising", "rent", "utilities", "other"] },
        { name: "vendor", label: "Vendor", type: "text", required: false, placeholder: "Optional vendor" },
        { name: "description", label: "Description", type: "text", required: true, placeholder: "What was it for?" },
      ],
      "Record expense ${amount} for {description}, category {category}, vendor {vendor}.",
      "Review expense"
    );
  }

  if (/remember\s+(this|that)|i want you to remember|remember something/.test(q)) {
    return form(
      "Remember this",
      "Tell me what should be retained. I will not claim it is saved unless the memory write actually succeeds.",
      [
        { name: "memory", label: "What should I remember?", type: "textarea", required: true, placeholder: "The fact, preference, decision, project context, or instruction" },
        { name: "type", label: "Type", type: "select", required: true, options: ["fact", "preference", "instruction", "project", "decision", "person", "vehicle", "business", "important_date", "workflow"] },
      ],
      "Remember this as a {type}: {memory}.",
      "Continue"
    );
  }

  if (/from now on|create.*rule|new.*rule/.test(q)) {
    return form(
      "From now on…",
      "Describe the rule in normal language. I’ll treat it as an automation intent, not pretend it is active until it is actually saved.",
      [
        { name: "rule", label: "Rule", type: "textarea", required: true, placeholder: "From now on, when…" },
      ],
      "From now on, {rule}",
      "Review rule"
    );
  }

  if (!summary) return null;
  const counts = summary.counts || {};

  if (/owe|outstanding|unpaid|overdue|cash flow|collections/.test(q)) {
    const invoices = Array.isArray(summary.unpaidInvoices) ? summary.unpaidInvoices.slice(0, 8) : [];
    return {
      version: 2,
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
      version: 2,
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
      version: 2,
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
      version: 2,
      type: "comparison",
      title: "Top customer snapshot",
      subtitle: "Ranked by lifetime value in the current authorized snapshot.",
      provenance: "server_snapshot",
      generatedAt: nowIso(),
      items: customers.map((customer) => ({ label: customer.name || "Customer", value: currency(customer.value), status: "info" })),
      actions: [{ kind: "navigate", label: "Open customers", path: "/customers" }],
    };
  }

  if (/what should i do next|success plan|priority|what am i forgetting|open loops/.test(q)) {
    const signal = summary.prioritySignals || {};
    return {
      version: 2,
      type: "decision",
      title: /forgetting|open loops/.test(q) ? "What deserves attention" : "Next-best action",
      subtitle: signal.headline || "No urgent operational signal is visible in the current snapshot.",
      provenance: "server_snapshot",
      generatedAt: nowIso(),
      items: [
        { label: "Priority", value: signal.level || "low", detail: signal.nextAction || "Review current work queue.", status: signal.level === "high" ? "danger" : signal.level === "medium" ? "warning" : "success" },
        ...(Array.isArray(signal.focusAreas) ? signal.focusAreas.slice(0, 3).map((area) => ({ label: area, value: "Focus", status: "info" })) : []),
      ],
      actions: [{ kind: "prompt", label: "Build my plan", prompt: "Turn this priority signal into a short step-by-step plan using only my authorized data and memory." }],
    };
  }

  if (pageContext?.entityType && pageContext?.entityId) {
    return {
      version: 2,
      type: "summary",
      title: pageContext.title || `${pageContext.entityType} context`,
      subtitle: "2nd Me recognizes the active page context but will not infer missing entity facts.",
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
    version: 2,
    type: "decision",
    title: confirm.confirmationSummary || "Confirm 2nd Me action",
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
