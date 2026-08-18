export function extractOpenAIResponseText(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();

  const parts = [];
  for (const item of Array.isArray(payload.output) ? payload.output : []) {
    if (item?.type !== "message") continue;
    for (const content of Array.isArray(item.content) ? item.content : []) {
      if ((content?.type === "output_text" || content?.type === "text") && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n").trim();
}

export async function requestTitanOpenAI({
  apiKey,
  systemPrompt,
  recentMessages = [],
  model = "gpt-5.6",
  maxOutputTokens = 700,
  fetchImpl = fetch,
} = {}) {
  if (!apiKey) return { ok: false, status: 0, error: "missing_api_key", text: "" };

  const input = recentMessages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .slice(-8)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 3000) }));

  const requestedModel = String(model || "").trim();
  const selectedModel =
    process.env.TITAN_AI_OPENAI_MODEL ||
    (requestedModel === "gpt-4o-mini" ? "gpt-5.6" : requestedModel) ||
    "gpt-5.6";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        instructions: String(systemPrompt || "").slice(0, 60_000),
        input,
        max_output_tokens: Math.max(200, Math.min(1600, Number(maxOutputTokens) || 700)),
        store: false,
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: (await response.text()).slice(0, 1000),
        text: "",
      };
    }

    const payload = await response.json();
    const text = extractOpenAIResponseText(payload);
    return { ok: Boolean(text), status: response.status, error: text ? "" : "empty_response", text, payload };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error?.name === "AbortError" ? "provider_timeout" : String(error?.message || error || "provider_error").slice(0, 1000),
      text: "",
    };
  } finally {
    clearTimeout(timeout);
  }
}
