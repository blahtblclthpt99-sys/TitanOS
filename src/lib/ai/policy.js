export const AI_ACTION_ALLOWLIST = new Set([
  "read_dashboard_summary",
  "read_jobs_overview",
  "read_invoices_overview",
  "read_messages_overview",
  "read_settings_overview",
]);

const clean = (v, max) => String(v ?? "").replace(/\u0000/g, "").slice(0, max);

export function sanitizeAiInput(input) {
  return {
    message: clean(input?.message, 4000),
    pageContext: clean(input?.pageContext, 6000),
    action: clean(input?.action, 120),
  };
}

export function assertAllowedAiAction(action) {
  if (!AI_ACTION_ALLOWLIST.has(action)) {
    const err = new Error("Action not allowed");
    err.code = "AI_ACTION_FORBIDDEN";
    throw err;
  }
}

export function publicAiError(err) {
  const code = err?.code || "AI_UNKNOWN";
  if (code === "AI_ACTION_FORBIDDEN") return { code, message: "That action is not available." };
  if (code === "AI_RATE_LIMITED") return { code, message: "Too many requests. Please retry shortly." };
  return { code: "AI_UNAVAILABLE", message: "AI is temporarily unavailable." };
}