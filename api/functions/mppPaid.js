/**
 * Machine Payments Protocol (MPP) paid endpoint.
 * Accepts Tempo crypto (pathUSD) + optional Stripe SPT (card/Link) via mppx.
 *
 * GET/POST /api/functions/mppPaid
 * - Unpaid → 402 + WWW-Authenticate Payment challenges
 * - Paid → JSON receipt payload
 * HEAD → config probe only (no Stripe PaymentIntent)
 *
 * Env:
 * - STRIPE_SECRET_KEY (required)
 * - STRIPE_PROFILE_ID (optional; auto-discovered via Profiles "me" when unset/invalid)
 * - MPP_SECRET_KEY (optional; derived from Stripe key if unset)
 * - MPP_TESTNET=1 (default) for Tempo testnet token
 * - MPP_TEMPO_AMOUNT / MPP_STRIPE_AMOUNT (optional USD strings)
 * - MPP_STRICT_CACHE=1 to reject payTo cache misses (single-instance only)
 *
 * @see https://docs.stripe.com/payments/machine/mpp/quickstart
 */

import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import {
  PATH_USD_MAINNET,
  PATH_USD_TESTNET,
  createPayToAddress,
  getMppChargeAmounts,
  getMppSecretKey,
  getMppStripeClient,
  isMppConfigured,
  publicMppError,
  resolveStripeProfileId,
} from "../_lib/mppStripe.js";

function applyMppHeaders(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate, Payment-Receipt");
}

function toWebRequest(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const proto = req.headers["x-forwarded-proto"] || "https";
  const url = `${proto}://${host}${req.url || "/"}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (value == null) continue;
    const lower = key.toLowerCase();
    if (lower === "host" || lower === "connection" || lower === "content-length" || lower === "transfer-encoding") {
      continue;
    }
    headers.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const method = (req.method || "GET").toUpperCase();
  /** @type {RequestInit} */
  const init = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    if (Buffer.isBuffer(req.body)) {
      init.body = req.body;
    } else if (typeof req.body === "string") {
      init.body = req.body;
    } else if (req.body != null) {
      init.body = JSON.stringify(req.body);
      if (!headers.has("content-type")) headers.set("content-type", "application/json");
    }
  }
  return new Request(url, init);
}

async function sendWebResponse(res, webRes) {
  applyMppHeaders(res);
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const buf = Buffer.from(await webRes.arrayBuffer());
  res.end(buf);
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  applyCors(res, req);
  applyMppHeaders(res);

  if (req.method !== "GET" && req.method !== "POST" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!assertRateLimit(req, res, { limit: 20, windowMs: 60_000, key: "mppPaid" })) return;

  const configured = isMppConfigured();

  if (req.method === "HEAD") {
    res.statusCode = configured ? 204 : 503;
    return res.end();
  }

  if (!configured) {
    return res.status(503).json({
      error: "MPP not configured",
      detail: "Set STRIPE_SECRET_KEY. Optional: STRIPE_PROFILE_ID (or create a Stripe Profile for SPT).",
    });
  }

  try {
    const { Mppx, stripe: mppStripe, tempo } = await import("mppx/server");
    const stripeClient = getMppStripeClient();
    const mppSecretKey = getMppSecretKey();
    if (!stripeClient || !mppSecretKey) {
      return res.status(503).json({ error: "MPP not configured" });
    }

    const testnet = String(process.env.MPP_TESTNET || "1") !== "0";
    const pathUsd = testnet ? PATH_USD_TESTNET : PATH_USD_MAINNET;
    const amounts = getMppChargeAmounts();
    const profileId = await resolveStripeProfileId();

    const request = toWebRequest(req);
    const recipientAddress = await createPayToAddress(request, { amountUsd: amounts.tempoUsd });

    const methods = [
      tempo.charge({
        currency: pathUsd,
        recipient: recipientAddress,
        testnet,
      }),
    ];

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

    const mppx = Mppx.create({
      methods,
      secretKey: mppSecretKey,
    });

    const handlers = [mppx.tempo.charge({ amount: amounts.tempoUsd, recipient: recipientAddress })];
    if (profileId) {
      handlers.push(mppx.stripe.charge({ amount: amounts.stripeUsd, currency: "usd" }));
    }

    const response =
      handlers.length === 1
        ? await handlers[0](request)
        : await Mppx.compose(...handlers)(request);

    if (response.status === 402) {
      return sendWebResponse(res, response.challenge);
    }

    const paid = response.withReceipt(
      Response.json({
        ok: true,
        service: "titanos-mpp",
        message: "Payment accepted",
        methods: profileId ? ["tempo", "stripe"] : ["tempo"],
        spt: Boolean(profileId),
        ts: new Date().toISOString(),
      })
    );
    return sendWebResponse(res, paid);
  } catch (err) {
    captureApiException?.(err, {
      route: "mppPaid",
      code: err?.code || undefined,
      stripeType: err?.type || undefined,
    });
    const pub = publicMppError(err);
    return res.status(pub.status).json({
      error: pub.error,
      code: pub.code || undefined,
    });
  }
}
