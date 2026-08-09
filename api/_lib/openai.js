import { logError } from "./safeLog.js";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Call OpenAI with a bounded request lifetime. API handlers should always
 * degrade gracefully when the provider is slow or temporarily unavailable.
 * @param {string} apiKey
 * @param {Record<string, unknown>} body
 * @param {{ timeoutMs?: number, route?: string }} [options]
 */
export async function createChatCompletion(apiKey, body, options = {}) {
  const controller = new AbortController();
  const timeoutMs = Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const raw = await response.text();
    let json = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      // Provider error pages are not safe or useful to pass to clients.
    }
    return { ok: response.ok, status: response.status, json };
  } catch (error) {
    logError(options.route || "openai", error?.name === "AbortError" ? "request timed out" : error);
    return { ok: false, status: 503, json: null };
  } finally {
    clearTimeout(timer);
  }
}

export function completionText(json) {
  const text = json?.choices?.[0]?.message?.content;
  return typeof text === "string" ? text.trim() : "";
}
