/**
 * Approved Titan AI office intents — single allowlist for confirm + execute.
 */

export const ALLOWED_AI_INTENTS = Object.freeze({
  schedule_job: {
    label: "Schedule job",
    path: "/jobs",
    description: "Creates a scheduled job owned by the user",
  },
  create_job: {
    label: "Create job",
    path: "/jobs",
    description: "Alias of schedule_job",
  },
  create_estimate: {
    label: "Create estimate",
    path: "/estimates",
    description: "Creates a draft estimate",
  },
  create_invoice: {
    label: "Create invoice",
    path: "/invoices",
    description: "Creates a draft invoice",
  },
  send_invoice: {
    label: "Mark invoice sent",
    path: "/invoices",
    description: "Creates invoice with status=sent (does not send email)",
    honesty: "Marks status as sent — email/share is separate in Invoices",
  },
});

export function isAllowedAiIntent(intent) {
  return Boolean(intent && ALLOWED_AI_INTENTS[intent]);
}

export function listAllowedIntentIds() {
  return Object.keys(ALLOWED_AI_INTENTS);
}
