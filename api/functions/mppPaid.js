/**
 * Machine Payments Protocol (MPP) paid endpoint.
 * Accepts Tempo crypto (pathUSD) + optional Stripe SPT (card/Link) via mppx.
 *
 * GET/POST /api/functions/mppPaid
 * - Unpaid → 402 + WWW-Authenticate Payment challenges
 * - Paid → JSON receipt payload
 * HEAD → config probe only (no Stripe PaymentIntent)
 * GET ?probe=1 → JSON config snapshot (no PaymentIntent)
 *
 * @see https://docs.stripe.com/payments/machine/mpp/quickstart
 */

import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import {
  createPayToAddress,
  getMppChargeAmounts,
  getMppPublicStatus,
  getMppSecretKey,
  getMppStripeClient,
  getPathUsdToken,
  isExpectedMppGap,
  isMppConfigured,
  isMppTestnet,
  publicMppError,
  resolveStripeProfileId,
} from "../_lib/mppStripe.js";

const MAX_BODY_BYTES = 64 * 1024;

function applyMppHeaders(res, reqId) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate, Payment-Receipt, X-Request-Id");
  if (reqId) res.setHeader("X-Request-Id", reqId);
}

function requestId(req) {
  const incoming = req.headers?.["x-request-id"] || req.headers?.["x-correlation-id"];
  if (typeof incoming === "string" && /^[A-Za-z0-9._-]{8,128}$/.test(incoming)) return incoming;
  return `mpp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function wantsProbe(req) {
  try {
    const q = req.query?.probe;
    if (q === "1" || String(q).toLowerCase() === "true") return true;
    const url = new URL(req.url || "/", "http://local");
    const p = url.searchParams.get("probe");
    return p === "1" || String(p || "").toLowerCase() === "true";
  } catch {
    return false;
  }
}

function toWebRequest(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const proto = req.headers["x-forwarded-proto"] || "https";
  // Strip query for challenge binding stability where possible; keep path.
  const pathOnly = String(req.url || "/").split("?")[0] || "/";
  const url = `${proto}://${host}${pathOnly}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (value == null) continue;
    const lower = key.toLowerCase();
    if (
      lower === "host" ||
      lower === "connection" ||
      lower === "content-length" ||
      lower === "transfer-encoding" ||
      lower === "keep-alive" ||
      lower === "proxy-connection"
    ) {
      continue;
    }
    headers.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const method = (req.method || "GET").toUpperCase();
  /** @type {RequestInit} */
  const init = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    if (Buffer.isBuffer(req.body)) {
      if (req.body.length > MAX_BODY_BYTES) {
        const err = new Error("Request body too large");
        err.code = "MPP_AUTH_TOO_LARGE";
        err.statusCode = 413;
        throw err;
      }
      init.body = req.body;
    } else if (typeof req.body === "string") {
      if (Buffer.byteLength(req.body, "utf8") > MAX_BODY_BYTES) {
        const err = new Error("Request body too large");
        err.code = "MPP_AUTH_TOO_LARGE";
        err.statusCode = 413;
        throw err;
      }
      init.body = req.body;
    } else if (req.body != null) {
      const json = JSON.stringify(req.body);
      if (Buffer.byteLength(json, "utf8") > MAX_BODY_BYTES) {
        const err = new Error("Request body too large");
        err.code = "MPP_AUTH_TOO_LARGE";
        err.statusCode = 413;
        throw err;
      }
      init.body = json;
      if (!headers.has("content-type")) headers.set("content-type", "application/json");
    }
  }
  return new Request(url, init);
}

async function sendWebResponse(res, webRes, reqId) {
  applyMppHeaders(res, reqId);
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => {
    // Don't let upstream overwrite our request id.
    if (key.toLowerCase() === "x-request-id") return;
    res.setHeader(key, value);
  });
  const buf = Buffer.from(await webRes.arrayBuffer());
  if (buf.length > 1_000_000) {
    return res.status(502).json({ error: "Upstream payment response too large", code: "mpp_response_too_large" });
  }
  res.end(buf);
}

export default async function handler(req, res) {
  const reqId = requestId(req);
  if (handleOptions(req, res)) return;
  applyCors(res, req);
  applyMppHeaders(res, reqId);

  if (req.method !== "GET" && req.method !== "POST" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, POST, HEAD, OPTIONS");
    return res.status(405).json({ error: "Method not allowed", requestId: reqId });
  }

  // Creating crypto PaymentIntents is costly — tight limit.
  if (!assertRateLimit(req, res, { limit: 20, windowMs: 60_000, key: "mppPaid" })) return;

  const configured = isMppConfigured();

  if (req.method === "HEAD") {
    res.statusCode = configured ? 204 : 503;
    return res.end();
  }

  if (wantsProbe(req)) {
    const status = getMppPublicStatus();
    return res.status(configured ? 200 : 503).json({
      ok: configured,
      service: "titanos-mpp",
      ...status,
      requestId: reqId,
      ts: new Date().toISOString(),
    });
  }

  if (!configured) {
    return res.status(503).json({
      error: "MPP not configured",
      detail: "Set STRIPE_SECRET_KEY. Optional: STRIPE_PROFILE_ID (or create a Stripe Profile for SPT).",
      requestId: reqId,
    });
  }

  try {
    const { Mppx, stripe: mppStripe, tempo } = await import("mppx/server");
    const stripeClient = getMppStripeClient();
    const mppSecretKey = getMppSecretKey();
    if (!stripeClient || !mppSecretKey) {
      return res.status(503).json({ error: "MPP not configured", requestId: reqId });
    }

    const amounts = getMppChargeAmounts();
    const pathUsd = getPathUsdToken();
    const testnet = isMppTestnet();
    const profileId = await resolveStripeProfileId();
    const request = toWebRequest(req);

    /** @type {`0x${string}` | null} */
    let recipientAddress = null;
    /** @type {string | null} */
    let cryptoSkipReason = null;
    try {
      recipientAddress = await createPayToAddress(request, { amountUsd: amounts.tempoUsd });
    } catch (cryptoErr) {
      cryptoSkipReason = cryptoErr?.code || "crypto_unavailable";
      if (!isExpectedMppGap(cryptoSkipReason)) {
        captureApiException?.(cryptoErr, {
          route: "mppPaid",
          phase: "createPayToAddress",
          requestId: reqId,
        });
      }
      if (!profileId) {
        const pub = publicMppError(cryptoErr);
        return res.status(pub.status).json({
          error: pub.error,
          code: pub.code || undefined,
          hint: "Enable Stablecoins/Crypto, or set a valid STRIPE_PROFILE_ID for SPT-only.",
          requestId: reqId,
        });
      }
    }

    const methods = [];
    if (recipientAddress) {
      methods.push(
        tempo.charge({
          currency: pathUsd,
          recipient: recipientAddress,
          testnet,
        })
      );
    }
    if (profileId) {
      methods.push(
        mppStripe.charge({
          client: stripeClient,
          networkId: profileId,
          paymentMethodTypes: ["card", "link"],
          decimals: 2,
        })
      );
    }

    if (methods.length === 0) {
      return res.status(503).json({
        error: "MPP has no payment methods available",
        code: cryptoSkipReason || "mpp_no_methods",
        requestId: reqId,
      });
    }

    const mppx = Mppx.create({
      methods,
      secretKey: mppSecretKey,
    });

    const handlers = [];
    if (recipientAddress) {
      handlers.push(mppx.tempo.charge({ amount: amounts.tempoUsd, recipient: recipientAddress }));
    }
    if (profileId) {
      handlers.push(
        mppx.stripe.charge({
          amount: amounts.stripeUsd,
          currency: amounts.stripeCurrency,
        })
      );
    }

    const response =
      handlers.length === 1
        ? await handlers[0](request)
        : await Mppx.compose(...handlers)(request);

    if (response.status === 402) {
      return sendWebResponse(res, response.challenge, reqId);
    }

    const methodNames = [];
    if (recipientAddress) methodNames.push("tempo");
    if (profileId) methodNames.push("stripe");

    const paid = response.withReceipt(
      Response.json({
        ok: true,
        service: "titanos-mpp",
        message: "Payment accepted",
        methods: methodNames,
        spt: Boolean(profileId),
        requestId: reqId,
        ts: new Date().toISOString(),
      })
    );
    return sendWebResponse(res, paid, reqId);
  } catch (err) {
    const code = err?.code || undefined;
    if (!isExpectedMppGap(code)) {
      captureApiException?.(err, {
        route: "mppPaid",
        code,
        stripeType: err?.type || undefined,
        requestId: reqId,
      });
    }
    const pub = publicMppError(err);
    return res.status(pub.status).json({
      error: pub.error,
      code: pub.code || undefined,
      requestId: reqId,
    });
  }
}
