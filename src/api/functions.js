import { supabase } from "./supabaseClient";

function apiError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

function functionsBaseUrl() {
  const configured = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (configured) return configured;
  // Relative /api only works on Vercel/local proxy — not IONOS static or Capacitor.
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocalWeb = host === "localhost" || host === "127.0.0.1";
    if (isLocalWeb && !window.Capacitor) return "";
  }
  return "";
}

async function postJson(url, payload, token) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw apiError(body.error || body.message || "Function call failed", response.status);
  }
  return body;
}

/** Local fallbacks so the app still responds when serverless API is unavailable. */
async function localFallback(functionName, payload) {
  if (functionName === "titanAI") {
    const last =
      (payload.messages || []).filter((m) => m.role === "user").slice(-1)[0]?.content || "";
    return {
      data: {
        type: "response",
        message:
          `I heard: "${last || "…"}". ` +
          "Titan AI needs the API host configured (VITE_API_BASE_URL). " +
          "Everything else in TitanOS works without it — use Jobs, Customers, and Invoices in the app.",
      },
    };
  }

  if (functionName === "seedMarketplace") {
    return { seeded: false, modules: [] };
  }

  if (functionName === "sendEmail") {
    console.info("[sendEmail local stub]", payload);
    return { success: true, stub: true };
  }

  if (
    functionName === "portalRequestOtp" ||
    functionName === "portalVerifyOtp" ||
    functionName === "portalGetData"
  ) {
    throw apiError(
      "Customer portal API is not available on this host yet. Core TitanOS app features still work.",
      503
    );
  }

  throw apiError(`Function "${functionName}" is unavailable offline`, 503);
}

export function createFunctionsModule() {
  return {
    async invoke(functionName, payload = {}) {
      const token = await getAccessToken();
      const base = functionsBaseUrl();
      const path = `/api/functions/${functionName}`;

      // Prefer configured API host, then same-origin /api (Vercel), then local fallback.
      const candidates = [];
      if (base) candidates.push(`${base}${path}`);
      if (!base && typeof window !== "undefined") {
        const host = window.location.hostname;
        if (host === "localhost" || host === "127.0.0.1") {
          candidates.push(path);
        }
      }

      let lastError;
      for (const url of candidates) {
        try {
          return await postJson(url, payload, token);
        } catch (error) {
          lastError = error;
        }
      }

      try {
        return await localFallback(functionName, payload);
      } catch (fallbackError) {
        throw lastError || fallbackError;
      }
    },
  };
}
