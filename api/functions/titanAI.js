import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";
import { buildTitanSystemPrompt, sanitizePageContext } from "../_lib/aiContext.js";
import { isAllowedAiIntent } from "../_lib/aiIntents.js";
import { requireFeature, FEATURES } from "../_lib/entitlements.js";
import { buildInvisibleInterface, buildConfirmationInterface } from "../_lib/invisibleInterface.js";
import { loadTitanMemoryContext } from "../_lib/titanMemoryContext.js";
import {
  detectSecondMeMemoryIntent,
  executeSecondMeMemoryAction,
  rollbackSecondMeMemoryAction,
} from "../_lib/secondMeMemoryActions.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function money(n) {
  return (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function isUnpaid(inv) {
  const s = String(inv.status || "").toLowerCase();
  return ["unpaid", "overdue", "sent", "partial", "open", "pending"].includes(s) || inv.balance_due > 0;
}

function invAmount(inv) {
  return Number(inv.total ?? inv.amount ?? inv.balance_due ?? 0) || 0;
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

  if (focusAreas.length < 3) focusAreas.push(todaysJobs > 0 ? "Dispatch readiness" : "Pipeline growth");

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

function buildSummary(businessData = {}) {
  const jobs = Array.isArray(businessData.jobs) ? businessData.jobs : [];
  const invoices = Array.isArray(businessData.invoices) ? businessData.invoices : [];
  const customers = Array.isArray(businessData.customers) ? businessData.customers : [];
  const expenses = Array.isArray(businessData.expenses) ? businessData.expenses : [];
  const employees = Array.isArray(businessData.employees) ? businessData.employees : [];
  const today = todayISO();
  const month = today.slice(0, 7);

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

  const collectedMonth = invoices
    .filter(
      (inv) =>
        String(inv.status || "").toLowerCase() === "paid" &&
        String(inv.paid_at || inv.invoice_date || inv.created_date || inv.created_at || "").startsWith(month)
    )
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

  const base = {
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
  return { ...base, prioritySignals: buildPrioritySignal(base) };
}

function buildSuccessPlan(summary) {
  const c = summary?.counts || {};
  const signals = summary?.prioritySignals || {};
  const overdueCount = Number(signals.overdueInvoices || c.unpaidInvoices || 0);
  const todays = Number(signals.todaysJobs || c.todaysJobs || 0);
  const outstanding = Number(signals.outstandingTotal || summary?.outstandingTotal || 0);
  const net = Number(signals.netThisMonth || summary?.netThisMonth || 0);
  const netLine = net >= 0 ? `Net this month is positive at ${money(net)}.` : `Net this month is negative at ${money(net)}.`;
  const priorities = [
    overdueCount > 0
      ? `Revenue recovery: follow up ${overdueCount} overdue invoice(s) totaling ${money(signals.overdueTotal || 0)}.`
      : outstanding > 0
        ? `Revenue recovery: ${money(outstanding)} remains outstanding.`
        : "Revenue recovery: no unpaid invoices detected in current snapshot.",
    todays > 0
      ? `Execution reliability: confirm dispatch readiness for ${todays} job(s) today.`
      : "Execution reliability: no jobs scheduled today, so queue outreach and booking work.",
    net >= 0
      ? "Margin protection: keep expense logging current so reports stay decision-grade."
      : "Margin protection: tighten spend and audit loss-driving categories this week.",
  ];
  return [
    "TitanOS success plan for today:",
    "",
    "What's happening:",
    `- Priority signal: ${signals.level || "low"} — ${signals.headline || "No priority signal available."}`,
    `- ${netLine}`,
    `- Outstanding AR: ${money(outstanding)} across ${overdueCount} invoice(s).`,
    `- Today's scheduled jobs in snapshot: ${todays}.`,
    "",
    "What's next:",
    `1. ${signals.nextAction || priorities[0]}`,
    `2. ${priorities[1]}`,
    `3. ${priorities[2]}`,
    `- Focus areas: ${(signals.focusAreas?.length ? signals.focusAreas : ["Collections", "Dispatch", "Reports"]).join(", ")}`,
  ].join("\n");
}

async function loadOwnedBusinessSummary(admin, userId) {
  const [jobsRes, invoicesRes, customersRes, expensesRes] = await Promise.all([
    admin.from("jobs").select("title,status,customer_name,scheduled_date,scheduled_time,scheduled_at").eq("created_by_id", userId).limit(80),
    admin.from("invoices").select("customer_name,bill_to,total,amount,balance_due,status,due_date,paid_at,invoice_date,created_date,created_at").eq("created_by_id", userId).limit(80),
    admin.from("customers").select("first_name,last_name,name,email,lifetime_value").eq("created_by_id", userId).limit(40),
    admin.from("expenses").select("amount,date,created_date,created_at").eq("created_by_id", userId).limit(80),
  ]);
  return buildSummary({
    jobs: jobsRes.data || [],
    invoices: invoicesRes.data || [],
    customers: customersRes.data || [],
    expenses: expensesRes.data || [],
    employees: [],
  });
}

function answerLocally(question, summary) {
  const q = String(question || "").toLowerCase();
  if (!summary) return null;

  if (/how (do|can) (we|i) (win|succeed)|titanos success|production success|daily plan|what should i do next|what('?s| is) the plan|launch checklist|go no go/.test(q)) {
    return buildSuccessPlan(summary);
  }
  if (/teach me titanos|train me on titanos|how do i run titanos|operator playbook/.test(q)) {
    return [
      "TitanOS operator training lane:",
      "- Morning: ask for today's success plan.",
      "- Revenue: ask who owes money, then review invoice actions.",
      "- Execution: ask what jobs are today, then confirm schedule readiness.",
      "- Margin: ask about net, then log missing expenses.",
      "- Closeout: ask for wins, risks, and unresolved loops.",
    ].join("\n");
  }
  if (/today'?s jobs|jobs?.*today|today.*(job|schedule)|what('s| is) on (my )?schedule/.test(q)) {
    if (!summary.todaysJobs.length) return "You have **no jobs scheduled for today**.";
    return `**Today's jobs (${summary.todaysJobs.length}):**\n${summary.todaysJobs
      .map((j) => `- **${j.title}** (${j.status})${j.customer ? ` — ${j.customer}` : ""}${j.time ? ` @ ${j.time}` : ""}`)
      .join("\n")}`;
  }
  if (/owe|outstanding|unpaid|overdue|who.*(money|pay)/.test(q)) {
    if (!summary.unpaidInvoices.length) return `No unpaid invoices in the current snapshot. Outstanding AR: **${money(summary.outstandingTotal)}**.`;
    return `**Outstanding: ${money(summary.outstandingTotal)}** across ${summary.counts.unpaidInvoices} invoice(s):\n${summary.unpaidInvoices
      .map((i) => `- **${i.customer}** — ${money(i.amount)} (${i.status}${i.due ? `, due ${i.due}` : ""})`)
      .join("\n")}`;
  }
  if (/revenue|collected|income|sales this month/.test(q)) {
    return `This month you've collected **${money(summary.collectedThisMonth)}**. Outstanding AR is **${money(summary.outstandingTotal)}**.`;
  }
  if (/profit|margin|net/.test(q)) {
    return `This month: collected **${money(summary.collectedThisMonth)}**, expenses **${money(summary.expensesThisMonth)}**, net **${money(summary.netThisMonth)}**.`;
  }
  if (/top customers|best customers|lifetime/.test(q)) {
    if (!summary.topCustomers.length) return "No customer lifetime values yet.";
    return `**Top customers:**\n${summary.topCustomers.map((c, i) => `${i + 1}. **${c.name}** — ${money(c.value)}`).join("\n")}`;
  }
  if (/how many (customers|jobs|invoices|employees)/.test(q)) {
    const c = summary.counts;
    return `**YOUR DATA** (current snapshot sample): **${c.customers}** customers, **${c.jobs}** jobs, **${c.invoices}** invoices, and **${c.employees}** employees. Counts are capped to recent rows — open Customers/Jobs/Invoices for the full list.`;
  }
  return null;
}

export function detectConfirmIntent(question) {
  const memoryIntent = detectSecondMeMemoryIntent(question);
  if (memoryIntent) return memoryIntent;

  const q = String(question || "").toLowerCase();
  const customer =
    q.match(/(?:for|with|customer)\s+([a-z][a-z\s.'-]{1,80})/)?.[1]?.trim() ||
    q.match(/([a-z][a-z\s.'-]{1,80})\s+(?:tomorrow|today|next)/)?.[1]?.trim() ||
    "";

  if (/schedule\s+(a\s+)?job|book\s+(an?\s+)?appointment|add\s+(a\s+)?job/.test(q)) {
    const date = /tomorrow/.test(q)
      ? new Date(Date.now() + 86400000).toISOString().slice(0, 10)
      : /today/.test(q)
        ? todayISO()
        : new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    return {
      type: "confirm",
      intent: "schedule_job",
      confirmationSummary: `Schedule a job${customer ? ` for ${customer}` : ""} on ${date}?`,
      confirmationDetails: [customer ? `Customer: ${customer}` : "Customer: (add name on confirm or edit after)", `Date: ${date}`, "Status: scheduled"],
      params: { customer_name: customer, scheduled_date: date, title: customer ? `Job for ${customer}` : "New job", service_type: "General" },
    };
  }

  if (/create\s+(an?\s+)?estimate|draft\s+(an?\s+)?estimate|write\s+(an?\s+)?estimate/.test(q)) {
    const amount = Number(q.match(/\$?\s*(\d{2,6})/)?.[1]) || 0;
    return {
      type: "confirm",
      intent: "create_estimate",
      confirmationSummary: `Create an estimate draft${customer ? ` for ${customer}` : ""}${amount ? ` around $${amount}` : ""}?`,
      confirmationDetails: [customer ? `Customer: ${customer}` : "Customer: (optional)", amount ? `Total: $${amount}` : "Total: set after creation"],
      params: { customer_name: customer, total: amount, title: "Service estimate" },
    };
  }

  if (/create\s+(an?\s+)?invoice|send\s+(an?\s+)?invoice|bill\s+/.test(q)) {
    const amount = Number(q.match(/\$?\s*(\d{2,6})/)?.[1]) || 0;
    const send = /send/.test(q);
    return {
      type: "confirm",
      intent: send ? "send_invoice" : "create_invoice",
      confirmationSummary: `${send ? "Create invoice marked sent" : "Create"} an invoice${customer ? ` for ${customer}` : ""}${amount ? ` for $${amount}` : ""}?`,
      confirmationDetails: [
        customer ? `Customer: ${customer}` : "Customer: (optional)",
        amount ? `Amount: $${amount}` : "Amount: set after creation",
        send ? "Note: marks status sent — email/share is separate in Invoices" : "Status: draft",
      ],
      params: { customer_name: customer, total: amount },
    };
  }

  if (/add\s+(a\s+)?customer|create\s+(a\s+)?customer|new\s+customer/.test(q)) {
    const nameMatch = q.match(/(?:customer|named)\s+([a-z][a-z\s.'-]{1,80})/);
    const fullName = (nameMatch?.[1] || customer || "").trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    const first = parts[0] || "Customer";
    const last = parts.length > 1 ? parts.slice(1).join(" ") : "";
    const email = q.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/)?.[0] || "";
    const phone = q.match(/(?:\+?1\s*)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] || "";
    return {
      type: "confirm",
      intent: "create_customer",
      confirmationSummary: `Create customer${fullName ? ` ${fullName}` : ""}${email ? ` (${email})` : ""}?`,
      confirmationDetails: [`Name: ${[first, last].filter(Boolean).join(" ")}`, email ? `Email: ${email}` : "Email: optional", phone ? `Phone: ${phone}` : "Phone: optional"],
      params: { first_name: first, last_name: last, customer_name: [first, last].filter(Boolean).join(" "), email, phone, status: "lead", source: "ai" },
    };
  }

  if (/record\s+(an?\s+)?expense|add\s+(an?\s+)?expense|log\s+(an?\s+)?expense/.test(q)) {
    const amount = Number(q.match(/\$\s*(\d+(?:\.\d{1,2})?)/)?.[1] || q.match(/(\d+(?:\.\d{1,2})?)\s*(dollars?|usd)/)?.[1] || 0);
    const category = q.match(/\b(fuel|gas|parking|tolls|meals|insurance|repairs?|maintenance|supplies|software|phone|advertising|rent|utilities)\b/)?.[1] || "other";
    const vendor = q.match(/(?:at|from|vendor)\s+([a-z0-9&.' -]{2,80})/)?.[1]?.trim() || "";
    const description = q.match(/(?:for|on)\s+([a-z0-9&.' -]{2,120})/)?.[1]?.trim() || `${category} expense`;
    if (!amount || !Number.isFinite(amount) || amount <= 0) {
      return { type: "clarify", message: "I can record that expense, but I need an amount. Example: record expense $42.50 for fuel at Shell." };
    }
    return {
      type: "confirm",
      intent: "record_expense",
      confirmationSummary: `Record $${amount.toLocaleString()} expense for ${description}?`,
      confirmationDetails: [`Amount: $${amount.toLocaleString()}`, `Category: ${category}`, vendor ? `Vendor: ${vendor}` : "Vendor: optional", `Date: ${todayISO()}`],
      params: { amount, category, vendor, description, date: todayISO(), is_tax_deductible: true, business_use_percent: 100 },
    };
  }

  if (/run\s+(the\s+)?(morning|startup)\s+(workflow|routine|ops)|morning ops/.test(q)) {
    return {
      type: "confirm",
      intent: "run_workflow",
      confirmationSummary: "Run Morning Ops workflow (customer, invoice draft, and expense log)?",
      confirmationDetails: ["Step 1: create customer lead 'Morning Lead'.", "Step 2: create invoice draft for $125 named Morning Ops Invoice.", "Step 3: record $15 operations expense for setup prep."],
      params: {
        workflowId: "morning_ops",
        steps: [
          { intent: "create_customer", params: { first_name: "Morning", last_name: "Lead", customer_name: "Morning Lead", status: "lead", source: "ai_workflow" } },
          { intent: "create_invoice", params: { customer_name: "Morning Lead", total: 125, notes: "Generated by Morning Ops workflow" } },
          { intent: "record_expense", params: { amount: 15, category: "supplies", description: "Morning setup prep", vendor: "Operations", date: todayISO() } },
        ],
      },
    };
  }

  if (/run\s+(the\s+)?cash\s+recovery\s+(workflow|routine|sprint)|cash recovery sprint/.test(q)) {
    return {
      type: "confirm",
      intent: "run_workflow",
      confirmationSummary: "Run Cash Recovery workflow (create and mark sent invoice draft)?",
      confirmationDetails: ["Step 1: create customer lead 'AR Followup'.", "Step 2: create invoice marked sent for $185."],
      params: {
        workflowId: "cash_recovery",
        steps: [
          { intent: "create_customer", params: { first_name: "AR", last_name: "Followup", customer_name: "AR Followup", status: "lead", source: "ai_workflow" } },
          { intent: "send_invoice", params: { customer_name: "AR Followup", total: 185, notes: "Generated by Cash Recovery workflow" } },
        ],
      },
    };
  }

  if (/run\s+(the\s+)?(closeout|shutdown|end of day)\s+(workflow|routine)|daily closeout/.test(q)) {
    return {
      type: "confirm",
      intent: "run_workflow",
      confirmationSummary: "Run Daily Closeout workflow (expense, estimate, and tomorrow job)?",
      confirmationDetails: ["Step 1: record $20 expense for closeout reconciliation.", "Step 2: create estimate draft for follow-up work at $240.", "Step 3: schedule a job for tomorrow."],
      params: {
        workflowId: "closeout",
        steps: [
          { intent: "record_expense", params: { amount: 20, category: "other", description: "Daily closeout reconciliation", vendor: "Operations", date: todayISO() } },
          { intent: "create_estimate", params: { customer_name: "Followup Customer", total: 240, title: "Follow-up service estimate", notes: "Generated by Daily Closeout workflow" } },
          { intent: "schedule_job", params: { customer_name: "Followup Customer", scheduled_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), title: "Follow-up job", service_type: "General" } },
        ],
      },
    };
  }

  return null;
}

async function executeWorkflow(admin, user, params = {}) {
  const steps = Array.isArray(params.steps) ? params.steps : [];
  if (steps.length < 1 || steps.length > 10) {
    const err = new Error("Workflow steps are invalid.");
    err.status = 400;
    throw err;
  }
  const { executeAiOfficeAction } = await import("./aiExecuteAction.js");
  const results = [];
  for (const step of steps) {
    const intent = String(step?.intent || "");
    if (!isAllowedAiIntent(intent) || intent === "remember_memory" || intent === "create_memory_rule") {
      const err = new Error(`Workflow step intent is not allowed: ${intent || "unknown"}`);
      err.status = 400;
      throw err;
    }
    const result = await executeAiOfficeAction(admin, user, intent, step?.params || {});
    results.push({ intent, ...result });
  }
  return {
    type: "workflow_done",
    workflowId: String(params.workflowId || "custom"),
    message: `Workflow complete: ${results.length} step(s) executed.`,
    steps: results,
    rollback: { kind: "workflow", steps: results.map((r) => r.rollback).filter(Boolean).reverse() },
  };
}

async function rollbackWorkflow(admin, user, rollbackAction = {}) {
  const { rollbackAiOfficeAction } = await import("./aiExecuteAction.js");
  const steps = Array.isArray(rollbackAction.steps) ? rollbackAction.steps : [];
  if (!steps.length) {
    const err = new Error("Rollback workflow payload is empty.");
    err.status = 400;
    throw err;
  }
  const results = [];
  for (const step of steps) results.push(await rollbackAiOfficeAction(admin, user, step));
  return { type: "done", message: `Workflow rollback complete: ${results.length} step(s) rolled back.` };
}

async function executeConfirmedAction(admin, user, confirmedAction) {
  const intent = confirmedAction.intent;
  if (intent === "run_workflow") return executeWorkflow(admin, user, confirmedAction.params || {});
  if (intent === "remember_memory" || intent === "create_memory_rule") {
    return executeSecondMeMemoryAction(admin, user, intent, confirmedAction.params || {});
  }
  const { executeAiOfficeAction } = await import("./aiExecuteAction.js");
  return executeAiOfficeAction(admin, user, intent, confirmedAction.params || {});
}

async function executeRollback(admin, user, rollbackAction) {
  if (rollbackAction.kind === "workflow") return rollbackWorkflow(admin, user, rollbackAction);
  if (rollbackAction.entity === "Memory") return rollbackSecondMeMemoryAction(admin, user, rollbackAction);
  const { rollbackAiOfficeAction } = await import("./aiExecuteAction.js");
  return rollbackAiOfficeAction(admin, user, rollbackAction);
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 30, windowMs: 60_000, key: "titanAI" }))) return;

  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Sign in to use 2nd Me." });

    const admin = getSupabaseAdmin();
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return res.status(401).json({ error: "Session expired. Please sign in again." });

    const entitled = await requireFeature(res, admin, userData.user, FEATURES.aiAssistant);
    if (!entitled) return;

    const body = readJson(req);
    const { messages = [], confirmedAction = null, rollbackAction = null, lawMastermind = false, guardrails = {} } = body;
    const pageContext = sanitizePageContext(body.pageContext);
    const killSwitchOn = Boolean(guardrails?.killSwitch);

    if (rollbackAction) {
      if (killSwitchOn) return res.status(200).json({ data: { type: "error", message: "Titan guardrail kill switch is ON. Disable it to run rollback actions." } });
      try {
        return res.status(200).json({ data: await executeRollback(admin, userData.user, rollbackAction) });
      } catch (execErr) {
        logError("titanAI:rollback", execErr);
        const status = execErr?.status === 400 || execErr?.status === 403 ? execErr.status : 200;
        if (status !== 200) return res.status(status).json({ error: execErr.message || "Rollback rejected" });
        return res.status(200).json({ data: { type: "error", message: "Rollback failed." } });
      }
    }

    if (confirmedAction?.intent) {
      if (killSwitchOn) return res.status(200).json({ data: { type: "error", message: "Titan guardrail kill switch is ON. Disable it to run write actions." } });
      if (confirmedAction.intent !== "run_workflow" && !isAllowedAiIntent(confirmedAction.intent)) {
        return res.status(400).json({ error: "That action is not available through 2nd Me." });
      }
      try {
        return res.status(200).json({ data: await executeConfirmedAction(admin, userData.user, confirmedAction) });
      } catch (execErr) {
        logError("titanAI:action_execute", execErr);
        const status = execErr?.status === 400 || execErr?.status === 403 ? execErr.status : 200;
        if (status !== 200) return res.status(status).json({ error: execErr.message || "Action rejected" });
        return res.status(200).json({ data: { type: "error", message: "I couldn't save that action. Nothing was silently changed." } });
      }
    }

    const lastMessage = messages.filter((m) => m.role === "user").slice(-1)[0]?.content || body.message || "";
    const summary = await loadOwnedBusinessSummary(admin, userData.user.id);
    const memoryContext = await loadTitanMemoryContext(admin, userData.user.id, lastMessage);

    const confirm = detectConfirmIntent(lastMessage);
    if (confirm) {
      if (confirm.type === "clarify") return res.status(200).json({ data: confirm });
      if (killSwitchOn && (confirm.intent === "run_workflow" || isAllowedAiIntent(confirm.intent))) {
        return res.status(200).json({ data: { type: "error", message: "Titan guardrail kill switch is ON. Disable it to run write actions." } });
      }
      return res.status(200).json({ data: { ...confirm, interface: buildConfirmationInterface(confirm) } });
    }

    const local = answerLocally(lastMessage, summary);
    if (local) {
      return res.status(200).json({
        data: {
          type: "response",
          message: local,
          source: "local",
          dataBasis: "server_snapshot",
          generalKnowledge: false,
          interface: buildInvisibleInterface({ question: lastMessage, summary, pageContext }),
        },
      });
    }

    const openAiKey = process.env.OPENAI_API_KEY;
    const recent = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
      .slice(-8)
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) }));

    if (!openAiKey) {
      const c = summary.counts || {};
      return res.status(200).json({
        data: {
          type: "response",
          source: "local",
          dataBasis: "server_snapshot",
          generalKnowledge: false,
          interface: buildInvisibleInterface({ question: lastMessage, summary, pageContext }),
          message:
            `**YOUR DATA** (live snapshot): **${c.customers || 0}** customers, **${c.jobs || 0}** jobs, **${c.invoices || 0}** invoices.\n\n` +
            `Outstanding AR **${money(summary.outstandingTotal)}**, collected this month **${money(summary.collectedThisMonth)}**.\n\n` +
            `You can also say "Remember this…", "From now on…", "schedule a job", "create an estimate", or "send an invoice".`,
        },
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 450,
        messages: [
          { role: "system", content: buildTitanSystemPrompt({ summary, pageContext, lawMastermind: Boolean(lawMastermind), memoryContext }) },
          ...recent,
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logError("titanAI:openai", errText.slice(0, 500));
      return res.status(200).json({
        data: {
          type: "response",
          source: "local",
          dataBasis: "server_snapshot",
          generalKnowledge: false,
          interface: buildInvisibleInterface({ question: lastMessage, summary, pageContext }),
          message: `AI provider is briefly unavailable. **YOUR DATA:** **${money(summary.outstandingTotal)}** outstanding, **${money(summary.collectedThisMonth)}** collected this month. You can still use the structured 2nd Me actions.`,
        },
      });
    }

    const completion = await response.json();
    const content = completion.choices?.[0]?.message?.content || "No response.";
    return res.status(200).json({
      data: {
        type: "response",
        message: content,
        source: "openai",
        dataBasis: "server_snapshot",
        generalKnowledge: true,
        interface: buildInvisibleInterface({ question: lastMessage, summary, pageContext }),
      },
    });
  } catch (error) {
    logError("titanAI", error);
    captureApiException(error, { tags: { route: "titanAI" } });
    return res.status(500).json({ error: "Something went wrong" });
  }
}
