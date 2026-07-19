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
