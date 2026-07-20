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
    const { answerFromSummary } = await import("@/lib/ai-business-summary");
    const last =
      (payload.messages || []).filter((m) => m.role === "user").slice(-1)[0]?.content || "";
    const summary = payload.businessSummary || null;
    const local = answerFromSummary(last, summary);
    return {
      data: {
        type: "response",
        source: "local",
        message:
          local ||
          "Titan AI is offline on this host. Connect to the web app (titanos-web.vercel.app) or check VITE_API_BASE_URL.",
      },
    };
  }

  if (functionName === "seedMarketplace") {
    return { seeded: false, modules: [] };
  }

  if (functionName === "sendEmail") {
    if (import.meta.env.DEV) console.info("[sendEmail local stub]", payload);
    return { success: true, stub: true };
  }

  if (functionName === "createPaymentLink") {
    return {
      payment: null,
      setupRequired: true,
      message: "Add STRIPE_SECRET_KEY on Vercel to enable live Stripe Checkout.",
      stub: true,
    };
  }

  if (functionName === "attachReferral") {
    return { ok: true, matched: false, stub: true };
  }

  if (functionName === "markReferralPaying") {
    return { ok: false, stub: true, error: "Billing hook unavailable offline" };
  }

  if (
    functionName === "portalRequestOtp" ||
    functionName === "portalVerifyOtp" ||
    functionName === "portalGetData" ||
    functionName === "portalAcceptEstimate" ||
    functionName === "portalPayInvoice" ||
    functionName === "portalLeaveReview"
  ) {
    throw apiError(
      "Customer portal API is not available on this host yet. Core TitanOS app features still work.",
      503
    );
  }

  if (functionName === "receiptVisionOcr") {
    return { text: "", source: "stub", message: "Vision OCR unavailable offline" };
  }

  if (functionName === "directionsOptimize") {
    return { ordered: payload.stops || [], totalMiles: 0, legs: [], method: "stub" };
  }

  if (functionName === "sendFollowUp") {
    if (import.meta.env.DEV) console.info("[sendFollowUp local stub]", payload);
    return { success: true, stub: true, emailed: false };
  }

  if (functionName === "aiExecuteAction") {
    return {
      data: {
        type: "done",
        message: "Action unavailable offline — open Jobs / Estimates / Invoices.",
      },
    };
  }

  throw apiError(`Function "${functionName}" is unavailable offline`, 503);
}

function candidateUrls(path) {
  const urls = [];
  const base = functionsBaseUrl();
  if (base) urls.push(`${base}${path}`);

  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    // Same-origin /api on Vercel / custom domains
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".vercel.app") ||
      hostname.endsWith("titanfieldos.com") ||
      hostname === "titanos-web.vercel.app"
    ) {
      urls.push(`${origin}${path}`);
      urls.push(path);
    }
  }

  return [...new Set(urls)];
}

export function createFunctionsModule() {
  return {
    async invoke(functionName, payload = {}) {
      const token = await getAccessToken();
      const path = `/api/functions/${functionName}`;
      const candidates = candidateUrls(path);

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
