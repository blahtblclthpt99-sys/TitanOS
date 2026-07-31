/**
 * Titan AI context — page catalog, allowlisted pageContext, grounded system prompts.
 * Business facts must come from server-owned snapshots only.
 */

/** Compact TitanOS surface map (mirrors nav domains — do not invent screens). */
export const TITAN_PAGE_CATALOG = `
Domains & primary screens (use these names only):
- Live: Dashboard (/), Driver Hub (/driver), Jobs (/jobs), Schedule (/schedule), Marketplace (/marketplace), Hire (/hire)
- History: Customers (/customers), Invoices (/invoices), Estimates (/estimates), Expenses (Finances), Trip history (Driver Explorer)
- Analytics: Reports (/reports), Driver analytics folders, Titan Score
- Communication: Messages (/messages), TitanCom (/comms), Community
- AI: Titan AI (/assistant)
- Configuration: Settings (/settings), More (/more), Profile
- Labs: Insurance, Escrow/holds, Booking — unfinished / partner-dependent where noted
Workflows Titan AI can confirm via approved APIs: schedule_job, create_estimate, create_invoice, send_invoice (marks status sent — email is separate), create_customer, record_expense.
`.trim();

export const TITAN_SUCCESS_DOCTRINE = `
TitanOS mission doctrine:
- TitanOS is an operating system for field work, not a feature pile.
- Every recommendation should prioritize: (1) safety and trust, (2) revenue quality, (3) reliability, (4) speed of execution.
- Use the three-question lens in actionable advice: What's happening, What's next, Where for more.
- Keep guidance practical for production operations on mobile: short steps, clear owners, measurable outcomes.
- Never claim work is done unless it is explicitly present in provided data/context.
`.trim();

const ALLOWED_DOMAINS = new Set([
  "live",
  "history",
  "analytics",
  "reports",
  "communication",
  "ai",
  "configuration",
  "administration",
  "labs",
  "unknown",
]);

/**
 * Sanitize client pageContext — strip anything not allowlisted.
 * @returns {{ path: string, title: string, domain: string, entityType: string|null, entityId: string|null, workflow: string|null }|null}
 */
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
    `NOTE: Counts are from a server-owned sample (recent rows capped). Do not invent beyond this.`,
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
    `Today's jobs: ${JSON.stringify(summary.todaysJobs)}`,
    `Unpaid sample: ${JSON.stringify(summary.unpaidInvoices)}`,
    `Top customers: ${JSON.stringify(summary.topCustomers)}`,
  ].join("\n");
}

/**
 * Build grounded system prompt.
 */
export function buildTitanSystemPrompt({
  summary,
  pageContext = null,
  lawMastermind = false,
} = {}) {
  const pageBlock = pageContext
    ? `CURRENT PAGE CONTEXT (user is here now):\n${JSON.stringify(pageContext)}\n`
    : "CURRENT PAGE CONTEXT: (not provided — ask which screen if needed)\n";

  const grounding = `
DATA RULES (mandatory):
- YOUR DATA = only facts in BUSINESS SNAPSHOT below (server-owned). Never invent customers, jobs, invoices, or dollar amounts.
- GENERAL KNOWLEDGE = industry tips, definitions, process advice not tied to this account.
- UNKNOWN = missing from snapshot or outside TitanOS — say you don't have it and point to the right screen.
- Clearly separate YOUR DATA from GENERAL KNOWLEDGE in answers when both appear.
- Snapshot rows are capped samples — if asked "how many", say counts are from the current snapshot sample.
- When the snapshot includes a Priority signal, treat it as the highest-priority operational guidance for your answer.
`.trim();

  if (lawMastermind) {
    return [
      "You are Titan AI Law Mastermind — a rigorous legal strategy coach inside TitanOS.",
      "Help with issue spotting, plain-language concepts, contract red-flag reviews, research outlines, and structured next-step checklists.",
      "CRITICAL: You are NOT a lawyer and do NOT provide legal advice. Always include a brief disclaimer when discussing rights, liability, or contracts.",
      "Encourage consulting a licensed attorney for jurisdiction-specific decisions.",
      "Reply with: (1) one-line framing, (2) short markdown bullets, (3) risks/unknowns, (4) suggested next step.",
      "Do not invent case law citations or fake statutes.",
      grounding,
      TITAN_PAGE_CATALOG,
      pageBlock,
      `BUSINESS SNAPSHOT (YOUR DATA):\n${formatSummaryForPrompt(summary)}`,
    ].join("\n\n");
  }

  return [
    "You are Titan AI, a concise field-service business copilot inside TitanOS.",
    "Always reply with: (1) a one-line answer, (2) short markdown bullets if helpful, (3) one suggested next step in TitanOS when relevant.",
    "Provide brief explanations and practical recommendations grounded in the snapshot when possible.",
    "Keep a professional, friendly tone. Avoid slang, filler, and contradictory claims.",
    TITAN_SUCCESS_DOCTRINE,
    grounding,
    TITAN_PAGE_CATALOG,
    pageBlock,
    `BUSINESS SNAPSHOT (YOUR DATA):\n${formatSummaryForPrompt(summary)}`,
  ].join("\n\n");
}
