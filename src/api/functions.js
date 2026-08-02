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
    // Offline: only answer from a client display snapshot with clear provenance —
    // never claim server truth. Prefer empty/unavailable over invented facts.
    const summary = payload.offlineSnapshot || null;
    const local = summary ? answerFromSummary(last, summary) : null;
    return {
      data: {
        type: "response",
        source: "offline",
        dataBasis: summary ? "device_cache" : "none",
        generalKnowledge: false,
        message:
          local ||
          "Titan AI needs a connection for live YOUR DATA answers. Reconnect, or open Jobs / Invoices / Customers directly.",
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
      message: "Checkout isn't set up yet. Contact support if you need live payments.",
      stub: true,
    };
  }

  if (functionName === "createAutopilotOrder" || functionName === "runAutopilotOrder") {
    throw apiError("Titan Autopilot requires a secure connection to the live billing service.", 503);
  }

  if (functionName === "calculateFee") {
    const { calculateFees, pickSeedRule } = await import("@/lib/feeEngine");
    const categoryId = payload.categoryId || payload.category_id || "service_requests";
    const contextKey = payload.contextKey || payload.context_key || payload.planId || "*";
    const rule = pickSeedRule(categoryId, contextKey);
    const result = calculateFees({
      grossAmount: Number(payload.grossAmount ?? payload.amount) || 0,
      rule,
    });
    return {
      fee: {
        categoryId,
        contextKey,
        gross: result.gross,
        platform_fee: result.platformFee,
        processing_fee: result.processingFee,
        tax_amount: result.taxAmount,
        net_amount: result.netAmount,
        final_total: result.finalTotal,
        rate: result.rate,
        label: result.label,
        config_source: "seed",
        stub: true,
      },
    };
  }

  if (functionName === "adminFees") {
    throw apiError("Fee admin API requires a signed-in admin on the live host.", 503);
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
