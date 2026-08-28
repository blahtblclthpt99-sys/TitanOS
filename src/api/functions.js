import { Capacitor } from "@capacitor/core";
import { supabase } from "./supabaseClient";

const FUNCTION_TIMEOUT_MS = 15_000;

function apiError(message, status = 400, code = "") {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

async function getAccessToken({ forceRefresh = false } = {}) {
  if (forceRefresh) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) return null;
    return data.session?.access_token || null;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return null;

  const expiresAtMs = Number(data.session.expires_at || 0) * 1000;
  if (expiresAtMs && expiresAtMs - Date.now() < 60_000) {
    const refreshed = await supabase.auth.refreshSession();
    if (!refreshed.error && refreshed.data.session?.access_token) {
      return refreshed.data.session.access_token;
    }
  }

  return data.session.access_token || null;
}

function functionsBaseUrl() {
  const configured = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (configured) return configured;
  return "";
}

async function postJson(url, payload, token) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FUNCTION_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw apiError(body.error || body.message || "Function call failed", response.status, "HTTP_ERROR");
    }
    return body;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw apiError("Titan service request timed out", 503, "TIMEOUT");
    }
    if (typeof error?.status === "number") throw error;
    throw apiError(error?.message || "Titan service is unreachable", 503, "NETWORK_ERROR");
  } finally {
    clearTimeout(timeoutId);
  }
}

function unavailableWrite(message) {
  throw apiError(message, 503, "OFFLINE_WRITE_BLOCKED");
}

/** Local fallbacks are read-only. Writes fail closed so Titan never reports fake success. */
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
          "2nd Me can't reach Titan's live data service right now. Retry in a moment or open Jobs / Invoices / Customers directly.",
      },
    };
  }

  if (functionName === "seedMarketplace") {
    return { seeded: false, modules: [] };
  }

  if (functionName === "sendEmail") {
    return unavailableWrite("Email was not sent because Titan's live messaging service is unavailable.");
  }

  if (functionName === "createPaymentLink") {
    return unavailableWrite("Payment link was not created because Titan's live billing service is unavailable.");
  }

  if (
    functionName === "createAutopilotOrder" ||
    functionName === "runAutopilotOrder" ||
    functionName === "runAutopilotMembership"
  ) {
    return unavailableWrite("Titan Autopilot requires a secure connection to the live billing service.");
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
    return unavailableWrite("Fee admin API requires a signed-in admin on the live host.");
  }

  if (functionName === "attachReferral" || functionName === "markReferralPaying") {
    return unavailableWrite("Referral changes require Titan's live service and were not saved.");
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
      503,
      "PORTAL_UNAVAILABLE"
    );
  }

  if (functionName === "receiptVisionOcr") {
    return { text: "", source: "stub", message: "Vision OCR unavailable offline" };
  }

  if (functionName === "directionsOptimize") {
    return { ordered: payload.stops || [], totalMiles: 0, legs: [], method: "stub" };
  }

  if (functionName === "sendFollowUp") {
    return unavailableWrite("Follow-up was not sent because Titan's live messaging service is unavailable.");
  }

  if (functionName === "aiExecuteAction") {
    return unavailableWrite("2nd Me could not complete the action because Titan's live action service is unavailable.");
  }

  throw apiError(`Function "${functionName}" is unavailable offline`, 503, "OFFLINE_UNAVAILABLE");
}

function candidateUrls(path) {
  const urls = [];
  const base = functionsBaseUrl();
  if (base) urls.push(`${base}${path}`);

  if (typeof window !== "undefined" && !Capacitor.isNativePlatform()) {
    const { hostname, origin, protocol } = window.location;
    const localHttp = protocol === "http:" && (hostname === "localhost" || hostname === "127.0.0.1");
    const secureWeb = protocol === "https:";
    if ((secureWeb || localHttp) && origin && origin !== "null") {
      urls.push(`${origin}${path}`);
      urls.push(path);
    }
  }

  return [...new Set(urls)];
}

function isClientRejection(error) {
  const status = Number(error?.status || 0);
  return status >= 400 && status < 500;
}

export function createFunctionsModule() {
  return {
    async invoke(functionName, payload = {}) {
      let token = await getAccessToken();
      const path = `/api/functions/${functionName}`;
      const candidates = candidateUrls(path);

      let lastError;
      let refreshedAfter401 = false;
      for (const url of candidates) {
        try {
          return await postJson(url, payload, token);
        } catch (error) {
          lastError = error;

          if (error?.status === 401 && !refreshedAfter401) {
            refreshedAfter401 = true;
            token = await getAccessToken({ forceRefresh: true });
            if (token) {
              try {
                return await postJson(url, payload, token);
              } catch (retryError) {
                lastError = retryError;
              }
            }
          }

          // Validation, authorization, entitlement, conflict, and rate-limit errors
          // are real server decisions. Do not mask them as an offline condition.
          if (isClientRejection(lastError)) break;
        }
      }

      if (isClientRejection(lastError)) {
        throw lastError;
      }

      try {
        return await localFallback(functionName, payload);
      } catch (fallbackError) {
        throw lastError || fallbackError;
      }
    },
  };
}
