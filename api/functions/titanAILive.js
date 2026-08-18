import titanAIHandler from "./titanAI.js";
import { logError } from "../_lib/safeLog.js";
import { captureApiException } from "../_lib/sentry.js";

const DEFAULT_OPENAI_MODEL = "gpt-5.6";
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

function providerConfig() {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey) {
    return {
      credential: openAiKey,
      url: "https://api.openai.com/v1/responses",
      model: process.env.TITAN_AI_OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      source: "openai-responses",
      gateway: false,
    };
  }

  const gatewayCredential = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!gatewayCredential) return null;

  return {
    credential: gatewayCredential,
    url: "https://ai-gateway.vercel.sh/v1/responses",
    model: process.env.TITAN_AI_GATEWAY_MODEL || DEFAULT_GATEWAY_MODEL,
    source: "vercel-ai-gateway",
    gateway: true,
  };
}

function providerInstructions(req, trustedServerAnswer) {
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

async function enhanceWithLiveProvider(req, originalPayload) {
  const provider = providerConfig();
  if (!provider) return originalPayload;

  const input = recentConversation(req);
  if (!input.length) return originalPayload;

  const requestBody = {
    model: provider.model,
    instructions: providerInstructions(req, originalPayload?.data?.message),
    input,
    max_output_tokens: 700,
    store: false,
  };

  if (provider.gateway) {
    requestBody.providerOptions = {
      gateway: {
        disallowPromptTraining: true,
      },
    };
  }

  const response = await fetch(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.credential}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const error = new Error(`TitanAI live provider returned ${response.status}`);
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
      source: provider.source,
      generalKnowledge: true,
      model: provider.model,
    },
  };
}

export default async function handler(req, res) {
  const originalJson = res.json.bind(res);

  res.json = (payload) => {
    const source = payload?.data?.source;
    const shouldEnhance =
      res.statusCode >= 200 &&
      res.statusCode < 300 &&
      payload?.data?.type === "response" &&
      (source === "local" || source === "openai");

    if (!shouldEnhance) return originalJson(payload);

    return enhanceWithLiveProvider(req, payload)
      .then((enhanced) => originalJson(enhanced))
      .catch((error) => {
        logError("titanAI:live_provider", error?.detail || error);
        captureApiException(error, { tags: { route: "titanAILive", phase: "live_provider" } });
        return originalJson(payload);
      });
  };

  try {
    return await titanAIHandler(req, res);
  } finally {
    res.json = originalJson;
  }
}
