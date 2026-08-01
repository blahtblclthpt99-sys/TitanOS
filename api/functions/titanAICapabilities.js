import { ALLOWED_AI_INTENTS, listAllowedIntentIds } from "../_lib/aiIntents.js";
import { applyCors, handleOptions } from "../_lib/cors.js";

export function buildTitanAiCapabilities() {
  return {
    service: "Titan AI",
    platform: "TitanOS",
    version: 1,
    integration: {
      transport: "https",
      basePath: "/api/functions",
      auth: {
        type: "bearer",
        issuer: "Supabase Auth",
        header: "Authorization: Bearer <access_token>",
      },
      browserCors: {
        requiredForCrossOrigin: true,
        configureWithEnv: "CORS_ALLOWED_ORIGINS",
        note:
          "Add your Base44 app origin to CORS_ALLOWED_ORIGINS for browser calls. Server-to-server calls do not need an Origin allowlist.",
      },
    },
    endpoints: {
      titanAICapabilities: {
        method: "GET",
        path: "/api/functions/titanAICapabilities",
        authRequired: false,
        description: "Returns the Titan AI integration contract for external clients.",
      },
      titanAI: {
        method: "POST",
        path: "/api/functions/titanAI",
        authRequired: true,
        description:
          "Primary Titan AI chat endpoint. Accepts messages, pageContext, confirmedAction, rollbackAction, and guardrails.",
        requestShape: {
          messages: [{ role: "user", content: "Who owes money right now?" }],
          pageContext: {
            path: "/assistant",
            title: "Titan AI",
            domain: "ai",
            workflow: "office",
          },
          confirmedAction: null,
          rollbackAction: null,
          lawMastermind: false,
          ownerAutopilot: false,
          guardrails: { killSwitch: false },
        },
        responseTypes: ["response", "clarify", "confirm", "done", "workflow_done", "error"],
      },
      aiExecuteAction: {
        method: "POST",
        path: "/api/functions/aiExecuteAction",
        authRequired: true,
        description: "Executes a confirmed Titan AI office action directly.",
        requestShape: {
          intent: "create_invoice",
          params: {
            customer_name: "Acme Service Co",
            total: 185,
          },
        },
        responseTypes: ["done", "error"],
      },
    },
    supportedIntents: listAllowedIntentIds().map((intent) => ({
      id: intent,
      ...ALLOWED_AI_INTENTS[intent],
    })),
    workflows: ["morning_ops", "cash_recovery", "closeout"],
    notes: [
      "Titan AI loads business facts from server-owned Supabase snapshots only.",
      "Client-provided business data is treated as offline fallback and not trusted for live answers.",
      "send_invoice marks invoice status sent; email/share still happens from the Invoices UI.",
    ],
  };
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  applyCors(res, req);

  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(200).json(buildTitanAiCapabilities());
}