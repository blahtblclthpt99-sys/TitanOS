const TITAN_BASE = "https://titanos-web.vercel.app";

async function titanFetch(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${TITAN_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = payload.error || payload.message || "Titan API request failed";
    const err = new Error(message);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}

export async function getTitanCapabilities() {
  return titanFetch("/api/functions/titanAICapabilities");
}

export async function chatTitanAI({
  supabaseAccessToken,
  messages,
  pageContext,
  lawMastermind = false,
  ownerAutopilot = false,
  killSwitch = false,
}) {
  return titanFetch("/api/functions/titanAI", {
    method: "POST",
    token: supabaseAccessToken,
    body: {
      messages,
      pageContext: pageContext || {
        path: "/assistant",
        title: "Titan AI",
        domain: "ai",
        workflow: "office",
      },
      lawMastermind,
      ownerAutopilot,
      guardrails: { killSwitch },
    },
  });
}

export async function executeTitanAction({
  supabaseAccessToken,
  intent,
  params,
}) {
  return titanFetch("/api/functions/aiExecuteAction", {
    method: "POST",
    token: supabaseAccessToken,
    body: { intent, params },
  });
}

export function mapTitanResponse(result) {
  const data = result?.data || {};

  if (data.type === "response") {
    return { kind: "assistant_message", text: data.message, raw: data };
  }

  if (data.type === "clarify") {
    return { kind: "clarify", text: data.message, raw: data };
  }

  if (data.type === "confirm") {
    return {
      kind: "confirm",
      intent: data.intent,
      params: data.params || {},
      summary: data.confirmationSummary || "Confirm action",
      details: Array.isArray(data.confirmationDetails) ? data.confirmationDetails : [],
      raw: data,
    };
  }

  if (data.type === "done" || data.type === "workflow_done") {
    return { kind: "completed", text: data.message || "Action complete", raw: data };
  }

  if (data.type === "error") {
    return { kind: "error", text: data.message || "Titan action failed", raw: data };
  }

  return { kind: "assistant_message", text: data.message || "No response", raw: data };
}
