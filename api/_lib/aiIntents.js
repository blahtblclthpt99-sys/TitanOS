/**
 * Approved Titan AI office intents — single allowlist for confirm + execute.
 */

export const ALLOWED_AI_INTENTS = Object.freeze({
  schedule_job: {
    label: "Schedule job",
    path: "/jobs",
    description: "Creates a scheduled job owned by the user",
    autopilotEligible: true,
  },
  create_job: {
    label: "Create job",
    path: "/jobs",
    description: "Alias of schedule_job",
    autopilotEligible: true,
  },
  create_estimate: {
    label: "Create estimate",
    path: "/estimates",
    description: "Creates a draft estimate",
    autopilotEligible: true,
  },
  create_invoice: {
    label: "Create invoice",
    path: "/invoices",
    description: "Creates a draft invoice",
    autopilotEligible: true,
  },
  send_invoice: {
    label: "Mark invoice sent",
    path: "/invoices",
    description: "Creates invoice with status=sent (does not send email)",
    honesty: "Marks status as sent — email/share is separate in Invoices",
    autopilotEligible: true,
  },
  create_customer: {
    label: "Create customer",
    path: "/customers",
    description: "Creates a customer record owned by the user",
    autopilotEligible: true,
  },
  record_expense: {
    label: "Record expense",
    path: "/finances",
    description: "Creates an expense record owned by the user",
    autopilotEligible: true,
  },
  remember_memory: {
    label: "Remember",
    path: "/ai-assistant",
    description: "Creates a user-owned 2nd Me memory node",
    autopilotEligible: false,
  },
  create_memory_rule: {
    label: "Create From now on rule",
    path: "/ai-assistant",
    description: "Creates a persistent user-owned 2nd Me workflow rule",
    autopilotEligible: false,
  },
});

export function isAllowedAiIntent(intent) {
  return Boolean(intent && ALLOWED_AI_INTENTS[intent]);
}

export function listAllowedIntentIds() {
  return Object.keys(ALLOWED_AI_INTENTS);
}
