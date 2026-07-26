import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";
import { buildTitanSystemPrompt, sanitizePageContext } from "../_lib/aiContext.js";
import { isAllowedAiIntent } from "../_lib/aiIntents.js";

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

function buildSummary(businessData = {}) {
  const jobs = Array.isArray(businessData.jobs) ? businessData.jobs : [];
  const invoices = Array.isArray(businessData.invoices) ? businessData.invoices : [];
  const customers = Array.isArray(businessData.customers) ? businessData.customers : [];
  const expenses = Array.isArray(businessData.expenses) ? businessData.expenses : [];
  const employees = Array.isArray(businessData.employees) ? businessData.employees : [];
  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);

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

  return {
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

/** Server-owned snapshot only — never trust client businessData / businessSummary. */
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
      return `No unpaid invoices in the current snapshot. Outstanding AR: **${money(summary.outstandingTotal)}**.`;
    }
    const list = summary.unpaidInvoices
      .map((i) => `- **${i.customer}** — ${money(i.amount)} (${i.status}${i.due ? `, due ${i.due}` : ""})`)
      .join("\n");
    return `**Outstanding: ${money(summary.outstandingTotal)}** across ${summary.counts.unpaidInvoices} invoice(s):\n${list}`;
  }

  if (/revenue|collected|income|sales this month/.test(q)) {
    return `This month you've collected **${money(summary.collectedThisMonth)}**. Outstanding AR is **${money(summary.outstandingTotal)}**.`;
  }

  if (/profit|margin|net/.test(q)) {
    return `This month: collected **${money(summary.collectedThisMonth)}**, expenses **${money(summary.expensesThisMonth)}**, net **${money(summary.netThisMonth)}**.`;
  }

  if (/top customers|best customers|lifetime/.test(q)) {
    if (!summary.topCustomers.length) return "No customer lifetime values yet.";
    const list = summary.topCustomers
      .map((c, i) => `${i + 1}. **${c.name}** — ${money(c.value)}`)
      .join("\n");
    return `**Top customers:**\n${list}`;
  }

  if (/how many (customers|jobs|invoices|employees)/.test(q)) {
    const c = summary.counts;
    return `**YOUR DATA** (current snapshot sample): **${c.customers}** customers, **${c.jobs}** jobs, **${c.invoices}** invoices, and **${c.employees}** employees. Counts are capped to recent rows — open Customers/Jobs/Invoices for the full list.`;
  }

  if (/schedule a job|create (an )?estimate|create (an )?invoice|record (a )?payment/.test(q)) {
    return "Use **Jobs → New**, **Estimates → New**, or **Invoices → New** in the app. Tell me customer + details if you want a quick checklist.";
  }

  return null;
}

function detectConfirmIntent(question) {
  const q = String(question || "").toLowerCase();
  const customer =
    q.match(/(?:for|with|customer)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/)?.[1] ||
    q.match(/([A-Z][a-z]+)\s+(?:tomorrow|today|next)/)?.[1] ||
    "";

  if (/schedule\s+(a\s+)?job|book\s+(an?\s+)?appointment|add\s+(a\s+)?job/.test(q)) {
    const date = /tomorrow/.test(q)
      ? new Date(Date.now() + 86400000).toISOString().slice(0, 10)
      : /today/.test(q)
        ? new Date().toISOString().slice(0, 10)
        : new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    return {
      type: "confirm",
      intent: "schedule_job",
      confirmationSummary: `Schedule a job${customer ? ` for ${customer}` : ""} on ${date}?`,
      confirmationDetails: [
        customer ? `Customer: ${customer}` : "Customer: (add name on confirm or edit after)",
        `Date: ${date}`,
        "Status: scheduled",
      ],
      params: {
        customer_name: customer,
        scheduled_date: date,
        title: customer ? `Job for ${customer}` : "New job",
        service_type: "General",
      },
    };
  }

  if (/create\s+(an?\s+)?estimate|draft\s+(an?\s+)?estimate|write\s+(an?\s+)?estimate/.test(q)) {
    const amount = Number(q.match(/\$?\s*(\d{2,6})/)?.[1]) || 0;
    return {
      type: "confirm",
      intent: "create_estimate",
      confirmationSummary: `Create an estimate draft${customer ? ` for ${customer}` : ""}${amount ? ` around $${amount}` : ""}?`,
      confirmationDetails: [
        customer ? `Customer: ${customer}` : "Customer: (optional)",
        amount ? `Total: $${amount}` : "Total: set after creation",
      ],
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

  return null;
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await assertRateLimitAsync(req, res, { limit: 30, windowMs: 60_000, key: "titanAI" }))) return;

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return res.status(401).json({ error: "Sign in to use Titan AI." });
    }

    const admin = getSupabaseAdmin();
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) {
      return res.status(401).json({ error: "Session expired. Please sign in again." });
    }

    const body = readJson(req);
    const { messages = [], confirmedAction = null, lawMastermind = false } = body;
    const pageContext = sanitizePageContext(body.pageContext);

    if (confirmedAction?.intent) {
      if (!isAllowedAiIntent(confirmedAction.intent)) {
        return res.status(400).json({ error: "That action is not available through Titan AI." });
      }
      try {
        const { executeAiOfficeAction } = await import("./aiExecuteAction.js");
        const data = await executeAiOfficeAction(
          admin,
          userData.user,
          confirmedAction.intent,
          confirmedAction.params || {}
        );
        return res.status(200).json({ data });
      } catch (execErr) {
        logError("titanAI:action_execute", execErr);
        const status = execErr?.status === 400 || execErr?.status === 403 ? execErr.status : 200;
        if (status !== 200) {
          return res.status(status).json({ error: execErr.message || "Action rejected" });
        }
        return res.status(200).json({
          data: {
            type: "error",
            message:
              "I couldn't save that automatically. Open Jobs, Estimates, or Invoices to finish in one tap.",
          },
        });
      }
    }

    const lastMessage =
      messages.filter((m) => m.role === "user").slice(-1)[0]?.content || body.message || "";
    // Never trust client-supplied businessData (prompt injection). Load owned snapshot.
    const summary = await loadOwnedBusinessSummary(admin, userData.user.id);

    const confirm = detectConfirmIntent(lastMessage);
    if (confirm) {
      return res.status(200).json({ data: confirm });
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
          message:
            `**YOUR DATA** (live snapshot): **${c.customers || 0}** customers, **${c.jobs || 0}** jobs, **${c.invoices || 0}** invoices.\n\n` +
            `Outstanding AR **${money(summary.outstandingTotal)}**, collected this month **${money(summary.collectedThisMonth)}**.\n\n` +
            `Ask about today's jobs, who owes money, revenue, profit, or top customers — or say "schedule a job" / "create an estimate" / "send an invoice".`,
        },
      });
    }

    const systemPrompt = buildTitanSystemPrompt({
      summary,
      pageContext,
      lawMastermind: Boolean(lawMastermind),
    });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 450,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
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
          message:
            local ||
            `AI provider is briefly unavailable. **YOUR DATA:** **${money(summary.outstandingTotal)}** outstanding, **${money(summary.collectedThisMonth)}** collected this month. Try "today's jobs" or "who owes money?".`,
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
      },
    });
  } catch (error) {
    logError("titanAI", error);
    captureApiException(error, { tags: { route: "titanAI" } });
    return res.status(500).json({ error: "Something went wrong" });
  }
}
