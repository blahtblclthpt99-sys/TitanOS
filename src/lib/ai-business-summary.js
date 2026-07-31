/**
 * Compact business snapshot for Titan AI (keeps prompts small + fast).
 */
function money(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthPrefix() {
  return new Date().toISOString().slice(0, 7);
}

function invAmount(inv) {
  return Number(inv.total ?? inv.amount ?? inv.balance_due ?? 0) || 0;
}

function isUnpaid(inv) {
  const s = String(inv.status || "").toLowerCase();
  return ["unpaid", "overdue", "sent", "partial", "open", "pending"].includes(s) || inv.balance_due > 0;
}

function dateOnly(value) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
}

function buildPrioritySignal(summary) {
  const counts = summary?.counts || {};
  const unpaidInvoices = Array.isArray(summary?.unpaidInvoices) ? summary.unpaidInvoices : [];
  const today = todayISO();
  const netThisMonth = Number(summary?.netThisMonth || 0);
  const overdueInvoices = unpaidInvoices.filter((invoice) => {
    const due = dateOnly(invoice.due);
    return due && due < today;
  });
  const overdueTotal = overdueInvoices.reduce((sum, invoice) => sum + (Number(invoice.amount) || 0), 0);
  const outstandingTotal = Number(summary?.outstandingTotal || 0);
  const todaysJobs = Number(counts.todaysJobs || 0);
  const unpaidCount = Number(counts.unpaidInvoices || unpaidInvoices.length || 0);

  const focusAreas = [];
  let level = "low";
  let headline = "Operations look stable: no urgent cash or dispatch issues in the current snapshot.";
  let nextAction = "Use Jobs, Customers, or Estimates to generate the next opportunity.";

  if (overdueTotal > 0) {
    level = "high";
    headline = `Collections need attention: ${overdueInvoices.length} overdue invoice(s) totaling ${money(overdueTotal)}.`;
    nextAction = "Open Invoices and follow up on the oldest overdue balances first.";
    focusAreas.push("Collections", "Cash flow");
    if (todaysJobs > 0) focusAreas.push("Dispatch");
  } else if (todaysJobs > 0) {
    level = unpaidCount > 0 ? "medium" : "high";
    headline = `Dispatch needs attention: ${todaysJobs} job(s) are scheduled today.`;
    nextAction = "Open Jobs / Schedule and confirm time windows, crew readiness, and customer updates.";
    focusAreas.push("Dispatch", "Customer communication");
    if (unpaidCount > 0) focusAreas.push("Collections");
  } else if (netThisMonth < 0) {
    level = "medium";
    headline = `Margin needs attention: net this month is ${money(netThisMonth)}.`;
    nextAction = "Review Expenses and Reports for the biggest cost drivers.";
    focusAreas.push("Margin", "Expense review");
  } else if (outstandingTotal > 0) {
    level = "medium";
    headline = `Revenue recovery is still active: ${money(outstandingTotal)} remains outstanding.`;
    nextAction = "Open Invoices to review unpaid balances and send follow-ups where needed.";
    focusAreas.push("Collections", "Revenue recovery");
  }

  if (focusAreas.length < 3) {
    focusAreas.push(todaysJobs > 0 ? "Dispatch readiness" : "Pipeline growth");
  }

  return {
    level,
    headline,
    nextAction,
    focusAreas: [...new Set(focusAreas)].slice(0, 3),
    overdueInvoices: overdueInvoices.length,
    overdueTotal,
    outstandingTotal,
    todaysJobs,
    unpaidInvoices: unpaidCount,
    collectedThisMonth: Number(summary?.collectedThisMonth || 0),
    expensesThisMonth: Number(summary?.expensesThisMonth || 0),
    netThisMonth,
  };
}

export function buildBusinessSummary(businessData = {}) {
  const jobs = Array.isArray(businessData.jobs) ? businessData.jobs : [];
  const invoices = Array.isArray(businessData.invoices) ? businessData.invoices : [];
  const customers = Array.isArray(businessData.customers) ? businessData.customers : [];
  const expenses = Array.isArray(businessData.expenses) ? businessData.expenses : [];
  const employees = Array.isArray(businessData.employees) ? businessData.employees : [];

  const today = todayISO();
  const month = monthPrefix();

  const todaysJobs = jobs
    .filter((j) => String(j.scheduled_date || j.scheduled_at || "").startsWith(today))
    .slice(0, 12)
    .map((j) => ({
      title: j.title || "Job",
      status: j.status || "scheduled",
      customer: j.customer_name || "",
      time: j.scheduled_time || "",
    }));

  const unpaid = invoices.filter(isUnpaid);
  const unpaidList = unpaid.slice(0, 15).map((inv) => ({
    customer: inv.customer_name || inv.bill_to || "Customer",
    amount: invAmount(inv),
    status: inv.status || "unpaid",
    due: inv.due_date || "",
  }));

  const monthInvoices = invoices.filter((inv) =>
    String(inv.paid_at || inv.invoice_date || inv.created_date || inv.created_at || "").startsWith(month)
  );
  const collectedMonth = monthInvoices
    .filter((inv) => String(inv.status || "").toLowerCase() === "paid")
    .reduce((sum, inv) => sum + invAmount(inv), 0);
  const outstanding = unpaid.reduce((sum, inv) => sum + invAmount(inv), 0);
  const monthExpenses = expenses
    .filter((e) => String(e.date || e.created_date || e.created_at || "").startsWith(month))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const topCustomers = [...customers]
    .sort((a, b) => (Number(b.lifetime_value) || 0) - (Number(a.lifetime_value) || 0))
    .slice(0, 5)
    .map((c) => ({
      name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.name || c.email || "Customer",
      value: Number(c.lifetime_value) || 0,
    }));

  const prioritySignals = buildPrioritySignal({
    counts: {
      jobs: jobs.length,
      invoices: invoices.length,
      customers: customers.length,
      expenses: expenses.length,
      employees: employees.length,
      unpaidInvoices: unpaid.length,
      todaysJobs: todaysJobs.length,
    },
    todaysJobs,
    unpaidInvoices: unpaidList,
    outstandingTotal: outstanding,
    collectedThisMonth: collectedMonth,
    expensesThisMonth: monthExpenses,
    netThisMonth: collectedMonth - monthExpenses,
  });

  return {
    asOf: new Date().toISOString(),
    counts: {
      jobs: jobs.length,
      invoices: invoices.length,
      customers: customers.length,
      expenses: expenses.length,
      employees: employees.length,
      unpaidInvoices: unpaid.length,
      todaysJobs: todaysJobs.length,
    },
    todaysJobs,
    unpaidInvoices: unpaidList,
    outstandingTotal: outstanding,
    collectedThisMonth: collectedMonth,
    expensesThisMonth: monthExpenses,
    netThisMonth: collectedMonth - monthExpenses,
    topCustomers,
    prioritySignals,
  };
}

export function formatSummaryForPrompt(summary) {
  if (!summary) return "No business data loaded yet.";
  const lines = [
    `Snapshot as of ${summary.asOf}`,
    `Counts: ${JSON.stringify(summary.counts)}`,
    `Collected this month: ${money(summary.collectedThisMonth)}`,
    `Outstanding AR: ${money(summary.outstandingTotal)}`,
    `Expenses this month: ${money(summary.expensesThisMonth)}`,
    `Net this month: ${money(summary.netThisMonth)}`,
    summary.prioritySignals
      ? `Priority signal: ${summary.prioritySignals.level} — ${summary.prioritySignals.headline}`
      : "Priority signal: unavailable",
    summary.prioritySignals ? `Next action: ${summary.prioritySignals.nextAction}` : "Next action: unavailable",
    summary.prioritySignals && summary.prioritySignals.focusAreas.length
      ? `Focus areas: ${summary.prioritySignals.focusAreas.join(", ")}`
      : "Focus areas: unavailable",
    `Today's jobs (${summary.todaysJobs.length}): ${JSON.stringify(summary.todaysJobs)}`,
    `Unpaid invoices (sample): ${JSON.stringify(summary.unpaidInvoices)}`,
    `Top customers: ${JSON.stringify(summary.topCustomers)}`,
  ];
  return lines.join("\n");
}

/** Fast deterministic answers — no OpenAI required. */
export function answerFromSummary(question, summary) {
  const q = String(question || "").toLowerCase();
  if (!summary) {
    return "I don't have your business data loaded yet. Pull to refresh or open Titan AI again in a moment.";
  }

  const moneyFmt = money;

  if (
    /today'?s jobs|jobs?.*today|today.*(job|schedule)|what('s| is) on (my )?schedule/.test(q)
  ) {
    if (!summary.todaysJobs.length) return "You have **no jobs scheduled for today**.";
    const list = summary.todaysJobs
      .map((j) => `- **${j.title}** (${j.status})${j.customer ? ` — ${j.customer}` : ""}${j.time ? ` @ ${j.time}` : ""}`)
      .join("\n");
    return `**Today's jobs (${summary.todaysJobs.length}):**\n${list}`;
  }

  if (/owe|outstanding|unpaid|overdue|who.*(money|pay)/.test(q)) {
    if (!summary.unpaidInvoices.length) {
      return `No unpaid invoices in the current snapshot. Outstanding AR: **${moneyFmt(summary.outstandingTotal)}**.`;
    }
    const list = summary.unpaidInvoices
      .map((i) => `- **${i.customer}** — ${moneyFmt(i.amount)} (${i.status}${i.due ? `, due ${i.due}` : ""})`)
      .join("\n");
    return `**Outstanding: ${moneyFmt(summary.outstandingTotal)}** across ${summary.counts.unpaidInvoices} invoice(s):\n${list}`;
  }

  if (/revenue|collected|income|sales this month/.test(q)) {
    return `This month you've collected **${moneyFmt(summary.collectedThisMonth)}**. Outstanding AR is **${moneyFmt(summary.outstandingTotal)}**.`;
  }

  if (/profit|margin|net/.test(q)) {
    return `This month: collected **${moneyFmt(summary.collectedThisMonth)}**, expenses **${moneyFmt(summary.expensesThisMonth)}**, net **${moneyFmt(summary.netThisMonth)}**.`;
  }

  if (/what('?s| is) (the )?(next step|plan)|daily plan|success plan|what should i do next|where do i start|launch checklist|go no go/.test(q)) {
    const signals = summary.prioritySignals || {};
    const focusAreas = signals.focusAreas?.length ? signals.focusAreas.join(", ") : "Pipeline growth";
    return [
      `**${signals.headline || "Your TitanOS priority signal is unavailable in this snapshot."}**`,
      "",
      "What's next:",
      `- ${signals.nextAction || "Open Jobs, Invoices, or Reports to pick the highest-value action."}`,
      `- Focus: ${focusAreas}`,
      `- Snapshot: ${moneyFmt(summary.outstandingTotal)} outstanding, ${summary.counts.todaysJobs} job(s) today, net ${moneyFmt(summary.netThisMonth)}.`,
    ].join("\n");
  }

  if (/top customers|best customers|lifetime/.test(q)) {
    if (!summary.topCustomers.length) return "No customer lifetime values yet — add customers and invoices to build this list.";
    const list = summary.topCustomers
      .map((c, i) => `${i + 1}. **${c.name}** — ${moneyFmt(c.value)}`)
      .join("\n");
    return `**Top customers:**\n${list}`;
  }

  if (/how many (customers|jobs|invoices|employees)/.test(q) || /customer count|job count/.test(q)) {
    const c = summary.counts;
    return `You currently have **${c.customers}** customers, **${c.jobs}** jobs, **${c.invoices}** invoices, and **${c.employees}** employees in TitanOS.`;
  }

  if (/schedule a job|create (an )?estimate|create (an )?invoice|record (a )?payment/.test(q)) {
    return "I can guide you: use **Jobs → New**, **Estimates → New**, or **Invoices → New** in the app. Tell me the customer name and details if you want a draft checklist.";
  }

  return null;
}
