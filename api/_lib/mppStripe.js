/**
 * Stripe + MPP (Machine Payments Protocol) helpers.
 * Crypto deposit addresses (Tempo) + SPT fiat via mppx stripe.charge.
 * @see https://docs.stripe.com/payments/machine/mpp/quickstart
 */

import crypto from "crypto";
import Stripe from "stripe";
import { Credential } from "mppx";

/** Tempo testnet pathUSD / USDC placeholder used by Stripe MPP samples. */
export const PATH_USD_TESTNET = "0x20c0000000000000000000000000000000000000";

/** Mainnet Tempo USDC (docs). Flip when leaving testnet. */
export const PATH_USD_MAINNET = "0x20c000000000000000000000b9537d11c60e8b50";

export const MPP_CRYPTO_API_VERSION = "2026-03-25.preview";
export const MPP_PROFILE_API_VERSION = "2026-04-22.preview";

const DEPOSIT_TTL_MS = 5 * 60 * 1000;
const DEPOSIT_CACHE_MAX = 1024;
const PROFILE_CACHE_TTL_MS = 10 * 60 * 1000;
const STRIPE_FETCH_TIMEOUT_MS = 15_000;
const MAX_AUTH_HEADER_CHARS = 8_192;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const PROFILE_ID_RE = /^profile_[A-Za-z0-9_]+$/;
const ALLOWED_SPT_CURRENCIES = new Set(["usd"]);

/**
 * In-memory deposit address cache (TTL 5 min).
 * On multi-instance Vercel, prefer Redis / KV — same caveat as Stripe's node-cache sample.
 * @type {Map<string, number>}
 */
const paymentCache = new Map();

/** @type {{ id: string | null, exp: number } | null} */
let profileCache = null;

/** @type {Stripe | null} */
let stripeClientSingleton = null;

function cacheSet(addr) {
  const key = String(addr || "").toLowerCase();
  if (!key) return;
  paymentCache.set(key, Date.now() + DEPOSIT_TTL_MS);
  if (paymentCache.size > DEPOSIT_CACHE_MAX) {
    const now = Date.now();
    for (const [a, exp] of paymentCache) {
      if (exp < now) paymentCache.delete(a);
    }
    while (paymentCache.size > DEPOSIT_CACHE_MAX) {
      const first = paymentCache.keys().next().value;
      if (first == null) break;
      paymentCache.delete(first);
    }
  }
}

function cacheHas(addr) {
  const key = String(addr || "").toLowerCase();
  const exp = paymentCache.get(key);
  if (!exp) return false;
  if (exp < Date.now()) {
    paymentCache.delete(key);
    return false;
  }
  return true;
}

/** @param {unknown} addr */
export function isValidEvmAddress(addr) {
  return typeof addr === "string" && EVM_ADDRESS_RE.test(addr);
}

/**
 * Parse a USD amount string to cents with hard bounds (anti-abuse).
 * @param {unknown} amountUsd
 * @param {{ minCents?: number, maxCents?: number, fallbackCents?: number }} [bounds]
 */
export function usdToCents(amountUsd, bounds = {}) {
  const minCents = bounds.minCents ?? 1;
  const maxCents = bounds.maxCents ?? 10_000;
  const fallbackCents = bounds.fallbackCents ?? 1;
  if (typeof amountUsd === "string" && amountUsd.trim().length > 32) return fallbackCents;
  const n = Number(amountUsd);
  if (!Number.isFinite(n) || n <= 0) return fallbackCents;
  const cents = Math.round(n * 100);
  if (!Number.isSafeInteger(cents)) return fallbackCents;
  return Math.min(maxCents, Math.max(minCents, cents));
}

/** @param {unknown} profileId */
export function isValidStripeProfileId(profileId) {
  if (typeof profileId !== "string") return false;
  const id = profileId.trim();
  if (id.length < 10 || id.length > 128) return false;
  return PROFILE_ID_RE.test(id);
}

/** @param {unknown} currency */
export function isAllowedSptCurrency(currency) {
  return ALLOWED_SPT_CURRENCIES.has(String(currency || "").toLowerCase());
}

export function isMppTestnet() {
  return String(process.env.MPP_TESTNET || "1") !== "0";
}

export function getPathUsdToken() {
  return isMppTestnet() ? PATH_USD_TESTNET : PATH_USD_MAINNET;
}

export function getMppSecretKey() {
  const explicit = process.env.MPP_SECRET_KEY;
  if (typeof explicit === "string" && explicit.length >= 32 && explicit.length <= 512) {
    return explicit;
  }
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey || stripeKey.length < 20) return null;
  return crypto.createHmac("sha256", stripeKey).update("mpp-challenge-signing").digest("base64");
}

/**
 * Crypto PaymentIntents require API version 2026-03-25.preview or later.
 * @returns {Stripe | null}
 */
export function getMppStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.length < 20) return null;
  if (stripeClientSingleton) return stripeClientSingleton;
  stripeClientSingleton = new Stripe(key, {
    // @ts-expect-error preview API for crypto deposit / MPP
    apiVersion: MPP_CRYPTO_API_VERSION,
    appInfo: {
      name: "TitanOS MPP",
      version: "1.5.4",
      url: "https://titanos-web.vercel.app",
    },
    maxNetworkRetries: 2,
    timeout: STRIPE_FETCH_TIMEOUT_MS,
  });
  return stripeClientSingleton;
}

export function isMppConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && getMppSecretKey());
}

export function hasEnvStripeProfileId() {
  return isValidStripeProfileId(process.env.STRIPE_PROFILE_ID);
}

/**
 * Safe Authorization header for Payment credentials (reject absurd sizes).
 * @param {Request} request
 */
export function getPaymentAuthHeader(request) {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  if (!auth) return null;
  if (auth.length > MAX_AUTH_HEADER_CHARS) {
    const err = new Error("Authorization header too large");
    err.code = "MPP_AUTH_TOO_LARGE";
    err.statusCode = 431;
    throw err;
  }
  return auth;
}

/**
 * @param {number} [ms]
 * @returns {{ signal: AbortSignal, clear: () => void }}
 */
export function withTimeout(ms = STRIPE_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

/**
 * Resolve SPT networkId: prefer STRIPE_PROFILE_ID, else Stripe Profiles "me" API.
 * Cached briefly to avoid hammering Stripe on every 402 challenge.
 * @returns {Promise<string | null>}
 */
export async function resolveStripeProfileId() {
  const fromEnv = String(process.env.STRIPE_PROFILE_ID || "").trim();
  if (isValidStripeProfileId(fromEnv)) return fromEnv;

  if (profileCache && profileCache.exp > Date.now()) {
    return profileCache.id;
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    profileCache = { id: null, exp: Date.now() + 30_000 };
    return null;
  }

  const { signal, clear } = withTimeout(8_000);
  try {
    const res = await fetch("https://api.stripe.com/v2/network/business_profiles/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Stripe-Version": MPP_PROFILE_API_VERSION,
      },
      signal,
    });
    if (!res.ok) {
      profileCache = { id: null, exp: Date.now() + 60_000 };
      return null;
    }
    const body = await res.json();
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    const resolved = isValidStripeProfileId(id) ? id : null;
    profileCache = { id: resolved, exp: Date.now() + PROFILE_CACHE_TTL_MS };
    return resolved;
  } catch {
    profileCache = { id: null, exp: Date.now() + 30_000 };
    return null;
  } finally {
    clear();
  }
}

export function getMppChargeAmounts() {
  const tempoUsd = process.env.MPP_TEMPO_AMOUNT || "0.01";
  const stripeUsd = process.env.MPP_STRIPE_AMOUNT || "0.50";
  const tempoCents = usdToCents(tempoUsd, { minCents: 1, maxCents: 500, fallbackCents: 1 });
  const stripeCents = usdToCents(stripeUsd, { minCents: 50, maxCents: 10_000, fallbackCents: 50 });
  const currency = String(process.env.MPP_STRIPE_CURRENCY || "usd").toLowerCase();
  return {
    tempoUsd: (tempoCents / 100).toFixed(2),
    stripeUsd: (stripeCents / 100).toFixed(2),
    tempoCents,
    stripeCents,
    stripeCurrency: isAllowedSptCurrency(currency) ? currency : "usd",
  };
}

/**
 * Stable idempotency key for deposit PaymentIntents (reduces duplicate addresses on retry).
 * @param {Request} request
 * @param {number} amountInCents
 */
export function depositIdempotencyKey(request, amountInCents) {
  const url = (() => {
    try {
      return new URL(request.url).pathname;
    } catch {
      return "/mppPaid";
    }
  })();
  const basis = `${url}|${amountInCents}|${isMppTestnet() ? "test" : "live"}`;
  return `mpp-dep-${crypto.createHash("sha256").update(basis).digest("hex").slice(0, 32)}`;
}

/**
 * Map internal errors to safe client payloads (no Stripe/PI internals).
 * @param {unknown} err
 */
export function publicMppError(err) {
  const code = err && typeof err === "object" && "code" in err ? String(err.code || "") : "";
  const statusHint =
    err && typeof err === "object" && "statusCode" in err
      ? Number(err.statusCode)
      : err && typeof err === "object" && "status" in err
        ? Number(err.status)
        : NaN;
  const msg =
    err && typeof err === "object" && "message" in err ? String(err.message || "").toLowerCase() : "";

  const map = {
    MPP_RECIPIENT_MISSING: { status: 400, error: "Invalid payment credential", code },
    MPP_PAYTO_INVALID: { status: 400, error: "Invalid payTo address", code },
    MPP_AUTH_TOO_LARGE: { status: 431, error: "Request headers too large", code },
    MPP_CRYPTO_DISPLAY_MISSING: {
      status: 502,
      error: "Crypto deposit unavailable. Enable Stablecoins/Crypto in Stripe.",
      code,
    },
    MPP_DEPOSIT_ADDRESS_MISSING: {
      status: 502,
      error: "Crypto deposit unavailable. Enable Stablecoins/Crypto in Stripe.",
      code,
    },
    MPP_NOT_CONFIGURED: {
      status: 503,
      error: "MPP not configured",
      code,
    },
    MPP_TIMEOUT: {
      status: 504,
      error: "Payment provider timed out. Try again shortly.",
      code,
    },
  };

  if (code && map[code]) return map[code];

  if (
    code === "parameter_unknown" ||
    code === "payment_method_type_invalid" ||
    msg.includes("unknown payment method") ||
    msg.includes("payment_method_types")
  ) {
    return {
      status: 502,
      error:
        "Crypto deposits unavailable. Request Stablecoins/Crypto in Stripe Dashboard → Payment methods.",
      code: "crypto_unavailable",
    };
  }
  if (code === "rate_limit" || statusHint === 429 || msg.includes("rate limit")) {
    return { status: 429, error: "Too many payment requests. Try again shortly.", code: "rate_limit" };
  }
  if (statusHint === 401 || statusHint === 403) {
    return { status: 502, error: "Payment provider rejected the request", code: "provider_auth" };
  }
  if (code === "AbortError" || msg.includes("aborted") || msg.includes("timeout")) {
    return { status: 504, error: "Payment provider timed out. Try again shortly.", code: "MPP_TIMEOUT" };
  }
  if (statusHint >= 400 && statusHint < 500) {
    return { status: 400, error: "Invalid payment request", code: code || "bad_request" };
  }

  return { status: 500, error: "MPP payment handler failed", code: code || "mpp_internal" };
}

/** Codes that are expected operational gaps (don't flood Sentry as critical). */
export function isExpectedMppGap(code) {
  return (
    code === "parameter_unknown" ||
    code === "payment_method_type_invalid" ||
    code === "crypto_unavailable" ||
    code === "MPP_CRYPTO_DISPLAY_MISSING" ||
    code === "MPP_DEPOSIT_ADDRESS_MISSING" ||
    code === "MPP_NOT_CONFIGURED"
  );
}

/**
 * Create or reuse a Stripe crypto deposit address for Tempo.
 * Matches Stripe MPP quickstart: Credential reuse + deposit_addresses.tempo.
 *
 * @param {Request} request
 * @param {{ amountUsd?: string }} [opts]
 * @returns {Promise<`0x${string}`>}
 */
export async function createPayToAddress(request, opts = {}) {
  const authHeader = getPaymentAuthHeader(request);
  if (authHeader && Credential.extractPaymentScheme(authHeader)) {
    const credential = Credential.fromRequest(request);
    const toAddress = /** @type {`0x${string}` | undefined} */ (
      credential.challenge?.request?.recipient
    );
    if (!toAddress || !isValidEvmAddress(toAddress)) {
      const err = new Error("Invalid payment credential recipient");
      err.code = "MPP_RECIPIENT_MISSING";
      throw err;
    }
    if (!cacheHas(toAddress) && process.env.MPP_STRICT_CACHE === "1") {
      const err = new Error("Invalid payTo address: not found in server cache");
      err.code = "MPP_PAYTO_INVALID";
      throw err;
    }
    return toAddress;
  }

  const amountInCents = usdToCents(opts.amountUsd || "0.01", {
    minCents: 1,
    maxCents: 500,
    fallbackCents: 1,
  });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    const err = new Error("STRIPE_SECRET_KEY required");
    err.code = "MPP_NOT_CONFIGURED";
    throw err;
  }

  const body = new URLSearchParams();
  body.set("amount", String(amountInCents));
  body.set("currency", "usd");
  body.append("payment_method_types[]", "crypto");
  body.set("payment_method_data[type]", "crypto");
  body.set("payment_method_options[crypto][mode]", "deposit");
  body.append("payment_method_options[crypto][deposit_options][networks][]", "tempo");
  body.set("confirm", "true");
  body.set("metadata[source]", "titanos-mpp");
  body.set("metadata[purpose]", "tempo-deposit");
  body.set("metadata[testnet]", isMppTestnet() ? "1" : "0");

  const { signal, clear } = withTimeout();
  let res;
  try {
    res = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": MPP_CRYPTO_API_VERSION,
        "Idempotency-Key": depositIdempotencyKey(request, amountInCents),
      },
      body,
      signal,
    });
  } catch (e) {
    const err = new Error(e?.name === "AbortError" ? "Stripe request timed out" : "Stripe request failed");
    err.code = e?.name === "AbortError" ? "MPP_TIMEOUT" : "MPP_CRYPTO_DISPLAY_MISSING";
    err.statusCode = e?.name === "AbortError" ? 504 : 502;
    throw err;
  } finally {
    clear();
  }

  const paymentIntent = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(paymentIntent?.error?.message || "Crypto PaymentIntent failed");
    err.code = paymentIntent?.error?.code || "MPP_CRYPTO_DISPLAY_MISSING";
    err.statusCode = res.status;
    err.param = paymentIntent?.error?.param;
    throw err;
  }

  if (!paymentIntent.next_action || !("crypto_display_details" in paymentIntent.next_action)) {
    const err = new Error("PaymentIntent did not return expected crypto deposit details");
    err.code = "MPP_CRYPTO_DISPLAY_MISSING";
    throw err;
  }

  const depositDetails = /** @type {{ deposit_addresses?: Record<string, { address?: string }> }} */ (
    paymentIntent.next_action.crypto_display_details
  );
  const payToAddress = depositDetails.deposit_addresses?.tempo?.address;
  if (!payToAddress || !isValidEvmAddress(payToAddress)) {
    const err = new Error("PaymentIntent did not return expected crypto deposit details");
    err.code = "MPP_DEPOSIT_ADDRESS_MISSING";
    throw err;
  }

  cacheSet(payToAddress);
  return /** @type {`0x${string}`} */ (payToAddress);
}

/** Config snapshot for probes (no secrets). */
export function getMppPublicStatus() {
  return {
    configured: isMppConfigured(),
    profileEnv: hasEnvStripeProfileId(),
    testnet: isMppTestnet(),
    amounts: getMppChargeAmounts(),
    pathUsd: getPathUsdToken(),
  };
}
