import { formatTitanMemoryForPrompt } from "./titanMemoryContext.js";

export const TITAN_PAGE_CATALOG = `
Domains & primary screens (use these names only):
- Live: Dashboard (/), Driver Hub (/driver), Jobs (/jobs), Schedule (/schedule), Marketplace (/marketplace), Hire (/hire)
- History: Customers (/customers), Invoices (/invoices), Estimates (/estimates), Expenses (Finances), Trip history (Driver Explorer)
- Analytics: Reports (/reports), Driver analytics folders, Titan Score
- Communication: Messages (/messages), TitanCom (/comms), Community
- AI: 2nd Me (/assistant)
- Configuration: Settings (/settings), More (/more), Profile
- Labs: Insurance, Escrow/holds, Booking — unfinished / partner-dependent where noted
Approved write workflows: schedule_job, create_estimate, create_invoice, send_invoice, create_customer, record_expense.
`.trim();

export const TITAN_SUCCESS_DOCTRINE = `
TitanOS mission doctrine:
- TitanOS is an operating system for field work, not a feature pile.
- Every recommendation should prioritize: (1) safety and trust, (2) revenue quality, (3) reliability, (4) speed of execution.
- Never claim work is done unless it is explicitly present in provided data/context.
`.trim();

export const SECOND_SELF_DOCTRINE = `
2nd Me operating model:
OBSERVE / REMEMBER → UNDERSTAND SITUATION → INFER INTENT → PRESENT THE RIGHT INTERFACE → REQUEST APPROPRIATE PERMISSION → ACT → LEARN.

Behavior rules:
- Do not behave like a generic question-answer chatbot when the user is trying to accomplish something.
- First determine what the user is trying to get done and what authorized context already answers.
- Use durable memory when relevant. Do not make the user repeat facts already present in supplied memory/context.
- When required information is missing, ask only for the minimum missing information. Prefer a structured Invisible Interface form over a dead-end paragraph.
- When the user is comparing, deciding, reviewing, planning, or prioritizing, prefer a temporary structured interface (comparison, checklist, metrics, decision, or form) when available.
- Never execute a write merely because an Invisible Interface rendered. Writes must remain behind the approved intent + confirmation + permission path.
- Do not invent capabilities, records, people, payments, jobs, dates, or remembered facts.
- "What am I forgetting?" means identify meaningful open loops from authorized data/memory, not generate generic reminders.
- "From now on…" expresses a durable rule/automation intent. If rule persistence is unavailable, clearly say the rule is not saved yet rather than pretending it is active.
- "Remember this" expresses memory intent. If persistence is unavailable for that request, do not claim it was remembered.
- Keep the conversational text concise because the interface should carry structure whenever possible.
`.trim();

const ALLOWED_DOMAINS = new Set([
  "live", "history", "analytics", "reports", "communication", "ai",
  "configuration", "administration", "labs", "unknown",
]);

export function sanitizePageContext(raw) {
  if (!raw || typeof raw !== "object") return null;
  const path = String(raw.path || "").slice(0, 200);
  if (!path.startsWith("/")) return null;
  const domain = String(raw.domain || "unknown").toLowerCase().slice(0, 40);
  return {
    path,
    title: String(raw.title || "").slice(0, 120),
    domain: ALLOWED_DOMAINS.has(domain) ? domain : "unknown",
    entityType: raw.entityType ? String(raw.entityType).slice(0, 40) : null,
    entityId: raw.entityId ? String(raw.entityId).slice(0, 80) : null,
    workflow: raw.workflow ? String(raw.workflow).slice(0, 60) : null,
  };
}

function money(n) {
  return (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function formatSummaryForPrompt(summary) {
  if (!summary) return "(no snapshot available)";
  return [
    "NOTE: Counts are from a server-owned sample (recent rows capped). Do not invent beyond this.",
    `Counts: ${JSON.stringify(summary.counts)}`,
    `Collected this month: ${money(summary.collectedThisMonth)}`,
    `Outstanding AR: ${money(summary.outstandingTotal)}`,
    `Expenses this month: ${money(summary.expensesThisMonth)}`,
    `Net this month: ${money(summary.netThisMonth)}`,
    summary.prioritySignals
      ? `Priority signal: ${summary.prioritySignals.level} — ${summary.prioritySignals.headline}`
      : "Priority signal: unavailable",
    summary.prioritySignals ? `Next action: ${summary.prioritySignals.nextAction}` : "Next action: unavailable",
    summary.prioritySignals?.focusAreas?.length
      ? `Focus areas: ${summary.prioritySignals.focusAreas.join(", ")}`
      : "Focus areas: unavailable",
    `Today's jobs: ${JSON.stringify(summary.todaysJobs)}`,
    `Unpaid sample: ${JSON.stringify(summary.unpaidInvoices)}`,
    `Top customers: ${JSON.stringify(summary.topCustomers)}`,
  ].join("\n");
}

export function buildTitanSystemPrompt({
  summary,
  pageContext = null,
  lawMastermind = false,
  memoryContext = [],
} = {}) {
  const pageBlock = pageContext
    ? `CURRENT PAGE CONTEXT:\n${JSON.stringify(pageContext)}\n`
    : "CURRENT PAGE CONTEXT: (not provided)\n";

  const grounding = `
DATA RULES (mandatory):
- YOUR DATA = only facts in BUSINESS SNAPSHOT below (server-owned).
- DURABLE MEMORY = only supplied authorized memory below.
- GENERAL KNOWLEDGE = information not tied to this account.
- UNKNOWN = missing from snapshot/memory. Say it is unknown rather than inventing it.
- Clearly distinguish current records from remembered context when both matter.
- Snapshot rows are capped samples.
- If durable memory conflicts with an authoritative current record, prefer the current record and disclose the conflict.
`.trim();

  if (lawMastermind) {
    return [
      "You are Titan AI Law Mastermind — a rigorous legal strategy coach inside TitanOS.",
      "Help with issue spotting, plain-language concepts, contract red-flag reviews, research outlines, and structured next-step checklists.",
      "You are not a lawyer and do not provide legal advice. Encourage licensed counsel for jurisdiction-specific decisions.",
      "Do not invent case law citations or statutes.",
      grounding,
      TITAN_PAGE_CATALOG,
      pageBlock,
      `DURABLE MEMORY (AUTHORIZED USER DATA):\n${formatTitanMemoryForPrompt(memoryContext)}`,
      `BUSINESS SNAPSHOT (YOUR DATA):\n${formatSummaryForPrompt(summary)}`,
    ].join("\n\n");
  }

  return [
    "You are 2nd Me, the personal intelligence and action layer inside TitanOS.",
    SECOND_SELF_DOCTRINE,
    TITAN_SUCCESS_DOCTRINE,
    grounding,
    TITAN_PAGE_CATALOG,
    pageBlock,
    `DURABLE MEMORY (AUTHORIZED USER DATA):\n${formatTitanMemoryForPrompt(memoryContext)}`,
    `BUSINESS SNAPSHOT (YOUR DATA):\n${formatSummaryForPrompt(summary)}`,
  ].join("\n\n");
}
