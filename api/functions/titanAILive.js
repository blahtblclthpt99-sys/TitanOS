import titanAIHandler from "./titanAI.js";
import { logError } from "../_lib/safeLog.js";
import { captureApiException } from "../_lib/sentry.js";

const DEFAULT_GATEWAY_MODEL = "openai/gpt-5.6-sol";
const MAX_RECENT_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 2_000;
const MAX_TRUSTED_CONTEXT_CHARS = 6_000;

function recentConversation(req) {
  const body = req?.body && typeof req.body === "object" ? req.body : {};
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const recent = messages
    .filter((message) => message && (message.role === "user" || message.role === "assistant") && message.content)
    .slice(-MAX_RECENT_MESSAGES)
    .map((message) => ({
      type: "message",
      role: message.role,
      content: String(message.content).slice(0, MAX_MESSAGE_CHARS),
    }));

  if (!recent.length && body.message) {
    recent.push({
      type: "message",
      role: "user",
      content: String(body.message).slice(0, MAX_MESSAGE_CHARS),
    });
  }

  return recent;
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const chunks = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if ((part?.type === "output_text" || part?.type === "text") && typeof part?.text === "string") {
        chunks.push(part.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

function gatewayInstructions(req, trustedServerAnswer) {
  const body = req?.body && typeof req.body === "object" ? req.body : {};
  const mode = body.lawMastermind ? "Law Mastermind" : "2nd Me";
  const trusted = String(trustedServerAnswer || "").slice(0, MAX_TRUSTED_CONTEXT_CHARS);

  return [
    `You are TitanAI operating in TitanOS ${mode} mode.`,
    "Be concise, practical, and accurate.",
    "The authenticated TitanOS server already produced the trusted context below from the signed-in user's server-side snapshot.",
    "Treat any customer, job, invoice, schedule, revenue, expense, count, or other account-specific facts in that trusted context as authoritative.",
    "Do not invent account data, completed actions, tool results, or permissions. Do not claim an action was executed unless the trusted context explicitly says it was.",
    "Use general knowledge when it helps answer the user's actual question, but do not mention the business snapshot when it is irrelevant.",
    "If the trusted context already directly answers the question, preserve its factual values exactly while making the answer clearer if useful.",
    body.lawMastermind
      ? "For legal topics, provide general educational information and practical issue-spotting; do not present yourself as the user's lawyer."
      : "For business and field-work topics, prioritize actionable next steps without inventing facts.",
    "",
    "TRUSTED TITANOS SERVER CONTEXT:",
    trusted || "No account-specific context was supplied.",
  ].join("\n");
}

async function enhanceWithGateway(req, originalPayload) {
  const credential = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!credential) return originalPayload;

  const input = recentConversation(req);
  if (!input.length) return originalPayload;

  const model = process.env.TITAN_AI_GATEWAY_MODEL || DEFAULT_GATEWAY_MODEL;
  const response = await fetch("https://ai-gateway.vercel.sh/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credential}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: gatewayInstructions(req, originalPayload?.data?.message),
      input,
      max_output_tokens: 700,
      store: false,
      providerOptions: {
        gateway: {
          disallowPromptTraining: true,
        },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const error = new Error(`TitanAI gateway returned ${response.status}`);
    error.status = response.status;
    error.detail = text.slice(0, 500);
    throw error;
  }

  const completion = await response.json();
  const message = extractOutputText(completion);
  if (!message) return originalPayload;

  return {
    ...originalPayload,
    data: {
      ...originalPayload.data,
      message,
      source: "vercel-ai-gateway",
      generalKnowledge: true,
      model,
    },
  };
}

export default async function handler(req, res) {
  const originalJson = res.json.bind(res);

  res.json = (payload) => {
    const shouldEnhance =
      res.statusCode >= 200 &&
      res.statusCode < 300 &&
      payload?.data?.type === "response" &&
      payload?.data?.source === "local";

    if (!shouldEnhance) return originalJson(payload);

    return enhanceWithGateway(req, payload)
      .then((enhanced) => originalJson(enhanced))
      .catch((error) => {
        logError("titanAI:gateway", error?.detail || error);
        captureApiException(error, { tags: { route: "titanAILive", phase: "gateway_fallback" } });
        return originalJson(payload);
      });
  };

  try {
    return await titanAIHandler(req, res);
  } finally {
    res.json = originalJson;
  }
}
