import accountDeletionRequest from "../api/functions/accountDeletionRequest.js";
import adminControl from "../api/functions/adminControl.js";
import adminFees from "../api/functions/adminFees.js";
import aiExecuteAction from "../api/functions/aiExecuteAction.js";
import analyticsIngest from "../api/functions/analyticsIngest.js";
import appVersion from "../api/functions/appVersion.js";
import attachReferral from "../api/functions/attachReferral.js";
import authMe from "../api/functions/auth/me.js";
import authRegister from "../api/functions/auth/register.js";
import calculateFee from "../api/functions/calculateFee.js";
import contractShareToken from "../api/functions/contractShareToken.js";
import createAutopilotOrder from "../api/functions/createAutopilotOrder.js";
import createNotification from "../api/functions/createNotification.js";
import createPaymentLink from "../api/functions/createPaymentLink.js";
import createSubscriptionCheckout from "../api/functions/createSubscriptionCheckout.js";
import directionsOptimize from "../api/functions/directionsOptimize.js";
import featureFlags from "../api/functions/featureFlags.js";
import googlePlayVerifySubscription from "../api/functions/googlePlayVerifySubscription.js";
import health from "../api/functions/health.js";
import installMarketplaceModule from "../api/functions/installMarketplaceModule.js";
import jobMatches from "../api/functions/jobMatches.js";
import jobMatchesV2 from "../api/functions/jobMatchesV2.js";
import markReferralPaying from "../api/functions/markReferralPaying.js";
import mppPaid from "../api/functions/mppPaid.js";
import paypalWebhook from "../api/functions/paypalWebhook.js";
import portalAcceptEstimate from "../api/functions/portalAcceptEstimate.js";
import portalGetData from "../api/functions/portalGetData.js";
import portalLeaveReview from "../api/functions/portalLeaveReview.js";
import portalPayInvoice from "../api/functions/portalPayInvoice.js";
import portalRequestOtp from "../api/functions/portalRequestOtp.js";
import portalVerifyOtp from "../api/functions/portalVerifyOtp.js";
import publicContract from "../api/functions/publicContract.js";
import receiptVisionOcr from "../api/functions/receiptVisionOcr.js";
import runAutopilotMembership from "../api/functions/runAutopilotMembership.js";
import runAutopilotOrder from "../api/functions/runAutopilotOrder.js";
import seedMarketplace from "../api/functions/seedMarketplace.js";
import sendEmail from "../api/functions/sendEmail.js";
import sendFollowUp from "../api/functions/sendFollowUp.js";
import sentryDebug from "../api/functions/sentryDebug.js";
import stripeCustomerPortal from "../api/functions/stripeCustomerPortal.js";
import stripeWebhook from "../api/functions/stripeWebhook.js";
import submitFeedback from "../api/functions/submitFeedback.js";
import subscriptionStatus from "../api/functions/subscriptionStatus.js";
import supportAI from "../api/functions/supportAI.js";
import supportAdminAssignCase from "../api/functions/supportAdminAssignCase.js";
import supportAgentGetCase from "../api/functions/supportAgentGetCase.js";
import supportAgentInbox from "../api/functions/supportAgentInbox.js";
import supportAgentReply from "../api/functions/supportAgentReply.js";
import supportAnalytics from "../api/functions/supportAnalytics.js";
import supportCreateCase from "../api/functions/supportCreateCase.js";
import supportEscalate from "../api/functions/supportEscalate.js";
import supportGetCase from "../api/functions/supportGetCase.js";
import supportIncidentAdmin from "../api/functions/supportIncidentAdmin.js";
import supportListCases from "../api/functions/supportListCases.js";
import supportPostMessage from "../api/functions/supportPostMessage.js";
import supportRefreshSubscription from "../api/functions/supportRefreshSubscription.js";
import supportRegisterAttachment from "../api/functions/supportRegisterAttachment.js";
import supportReopenCase from "../api/functions/supportReopenCase.js";
import supportSubmitCsat from "../api/functions/supportSubmitCsat.js";
import titanAI from "../api/functions/titanAI.js";
import titanAICapabilities from "../api/functions/titanAICapabilities.js";
import titanAILive from "../api/functions/titanAILive.js";

const ROUTES = new Map([
  ["accountDeletionRequest", accountDeletionRequest],
  ["adminControl", adminControl],
  ["adminFees", adminFees],
  ["aiExecuteAction", aiExecuteAction],
  ["analyticsIngest", analyticsIngest],
  ["appVersion", appVersion],
  ["attachReferral", attachReferral],
  ["auth/me", authMe],
  ["auth/register", authRegister],
  ["calculateFee", calculateFee],
  ["contractShareToken", contractShareToken],
  ["createAutopilotOrder", createAutopilotOrder],
  ["createNotification", createNotification],
  ["createPaymentLink", createPaymentLink],
  ["createSubscriptionCheckout", createSubscriptionCheckout],
  ["directionsOptimize", directionsOptimize],
  ["featureFlags", featureFlags],
  ["googlePlayVerifySubscription", googlePlayVerifySubscription],
  ["health", health],
  ["installMarketplaceModule", installMarketplaceModule],
  ["jobMatches", jobMatches],
  ["jobMatchesV2", jobMatchesV2],
  ["markReferralPaying", markReferralPaying],
  ["mppPaid", mppPaid],
  ["paypalWebhook", paypalWebhook],
  ["portalAcceptEstimate", portalAcceptEstimate],
  ["portalGetData", portalGetData],
  ["portalLeaveReview", portalLeaveReview],
  ["portalPayInvoice", portalPayInvoice],
  ["portalRequestOtp", portalRequestOtp],
  ["portalVerifyOtp", portalVerifyOtp],
  ["publicContract", publicContract],
  ["receiptVisionOcr", receiptVisionOcr],
  ["runAutopilotMembership", runAutopilotMembership],
  ["runAutopilotOrder", runAutopilotOrder],
  ["seedMarketplace", seedMarketplace],
  ["sendEmail", sendEmail],
  ["sendFollowUp", sendFollowUp],
  ["sentryDebug", sentryDebug],
  ["stripeCustomerPortal", stripeCustomerPortal],
  ["stripeWebhook", stripeWebhook],
  ["submitFeedback", submitFeedback],
  ["subscriptionStatus", subscriptionStatus],
  ["supportAI", supportAI],
  ["supportAdminAssignCase", supportAdminAssignCase],
  ["supportAgentGetCase", supportAgentGetCase],
  ["supportAgentInbox", supportAgentInbox],
  ["supportAgentReply", supportAgentReply],
  ["supportAnalytics", supportAnalytics],
  ["supportCreateCase", supportCreateCase],
  ["supportEscalate", supportEscalate],
  ["supportGetCase", supportGetCase],
  ["supportIncidentAdmin", supportIncidentAdmin],
  ["supportListCases", supportListCases],
  ["supportPostMessage", supportPostMessage],
  ["supportRefreshSubscription", supportRefreshSubscription],
  ["supportRegisterAttachment", supportRegisterAttachment],
  ["supportReopenCase", supportReopenCase],
  ["supportSubmitCsat", supportSubmitCsat],
  ["titanAI", titanAILive],
  ["titanAICapabilities", titanAICapabilities],
  ["titanAILive", titanAILive],
]);

function headersObject(headers) {
  const out = {};
  for (const [name, value] of headers.entries()) out[name.toLowerCase()] = value;
  return out;
}

function queryObject(url) {
  const out = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    out[key] = values.length > 1 ? values : values[0];
  }
  return out;
}

function parseCookies(value = "") {
  const out = {};
  for (const part of String(value).split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const raw = part.slice(index + 1).trim();
    try {
      out[key] = decodeURIComponent(raw);
    } catch {
      out[key] = raw;
    }
  }
  return out;
}

async function requestBody(request) {
  if (request.method === "GET" || request.method === "HEAD") {
    return { rawBody: Buffer.alloc(0), body: undefined };
  }
  const rawBody = Buffer.from(await request.arrayBuffer());
  if (!rawBody.length) return { rawBody, body: undefined };
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return { rawBody, body: JSON.parse(rawBody.toString("utf8")) };
    } catch {
      return { rawBody, body: rawBody.toString("utf8") };
    }
  }
  return { rawBody, body: rawBody.toString("utf8") };
}

async function legacyRequest(request) {
  const url = new URL(request.url);
  const { rawBody, body } = await requestBody(request);
  const headers = headersObject(request.headers);
  let yielded = false;
  return {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    headers,
    query: queryObject(url),
    cookies: parseCookies(headers.cookie),
    body,
    rawBody,
    async *[Symbol.asyncIterator]() {
      if (!yielded && rawBody.length) {
        yielded = true;
        yield rawBody;
      }
    },
  };
}

function legacyResponse() {
  let statusCode = 200;
  let ended = false;
  const headers = new Headers();
  const chunks = [];

  const response = {
    status(code) {
      statusCode = Number(code) || 500;
      return response;
    },
    statusCode,
    setHeader(name, value) {
      if (Array.isArray(value)) {
        headers.delete(name);
        for (const item of value) headers.append(name, String(item));
      } else {
        headers.set(name, String(value));
      }
      return response;
    },
    getHeader(name) {
      return headers.get(name);
    },
    removeHeader(name) {
      headers.delete(name);
      return response;
    },
    write(value) {
      if (value != null) chunks.push(value instanceof Uint8Array ? value : String(value));
      return true;
    },
    json(value) {
      headers.set("Content-Type", "application/json; charset=utf-8");
      chunks.length = 0;
      chunks.push(JSON.stringify(value));
      ended = true;
      return response;
    },
    send(value) {
      chunks.length = 0;
      if (value != null) chunks.push(value instanceof Uint8Array ? value : String(value));
      ended = true;
      return response;
    },
    end(value) {
      if (value != null) chunks.push(value instanceof Uint8Array ? value : String(value));
      ended = true;
      return response;
    },
    redirect(codeOrLocation, maybeLocation) {
      const hasCode = typeof codeOrLocation === "number";
      statusCode = hasCode ? codeOrLocation : 302;
      headers.set("Location", String(hasCode ? maybeLocation : codeOrLocation));
      ended = true;
      return response;
    },
    get writableEnded() {
      return ended;
    },
    toResponse() {
      const body = chunks.length ? chunks.map((chunk) => typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8")).join("") : null;
      return new Response(body, { status: statusCode, headers });
    },
  };
  Object.defineProperty(response, "statusCode", {
    get: () => statusCode,
    set: (value) => { statusCode = Number(value) || 500; },
  });
  return response;
}

export async function dispatchLegacyFunction(request) {
  const url = new URL(request.url);
  const prefix = "/api/functions/";
  if (!url.pathname.startsWith(prefix)) {
    return new Response("Not found", { status: 404 });
  }
  const route = url.pathname.slice(prefix.length).replace(/\/+$/, "");
  const handler = ROUTES.get(route);
  if (!handler) {
    return Response.json({ error: "API route not found" }, { status: 404 });
  }

  const req = await legacyRequest(request);
  const res = legacyResponse();
  try {
    await handler(req, res);
    if (!res.writableEnded && res.statusCode === 200) {
      res.status(204).end();
    }
    return res.toResponse();
  } catch (error) {
    console.error("Cloudflare API adapter error", {
      route,
      name: error?.name || "Error",
      message: error?.message || "Unhandled API error",
    });
    if (!res.writableEnded) {
      res.status(500).json({ error: "Internal server error" });
    }
    return res.toResponse();
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/functions/")) {
      return dispatchLegacyFunction(request);
    }
    return env.ASSETS.fetch(request);
  },
};

export { ROUTES };
