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

const DEPOSIT_TTL_MS = 5 * 60 * 1000;
const DEPOSIT_CACHE_MAX = 1024;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * In-memory deposit address cache (TTL 5 min).
 * On multi-instance Vercel, prefer Redis / KV — same caveat as Stripe's node-cache sample.
 * @type {Map<string, number>}
 */
const paymentCache = new Map();

function cacheSet(addr) {
  const key = String(addr || "").toLowerCase();
  if (!key) return;
  paymentCache.set(key, Date.now() + DEPOSIT_TTL_MS);
  if (paymentCache.size > DEPOSIT_CACHE_MAX) {
    const now = Date.now();
    for (const [a, exp] of paymentCache) {
      if (exp < now) paymentCache.delete(a);
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
  const maxCents = bounds.maxCents ?? 10_000; // $100 hard cap for MPP sample charges
  const fallbackCents = bounds.fallbackCents ?? 1;
  const n = Number(amountUsd);
  if (!Number.isFinite(n) || n <= 0) return fallbackCents;
  const cents = Math.round(n * 100);
  return Math.min(maxCents, Math.max(minCents, cents));
}

/** @param {unknown} profileId */
export function isValidStripeProfileId(profileId) {
  return typeof profileId === "string" && /^profile_[A-Za-z0-9_]+$/.test(profileId.trim());
}

export function getMppSecretKey() {
  if (process.env.MPP_SECRET_KEY && process.env.MPP_SECRET_KEY.length >= 32) {
    return process.env.MPP_SECRET_KEY;
  }
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return null;
  // Challenge binding secret — https://mpp.dev/protocol/challenges#challenge-binding
  return crypto.createHmac("sha256", stripeKey).update("mpp-challenge-signing").digest("base64");
}

/**
 * Crypto PaymentIntents require API version 2026-03-25.preview or later.
 * @returns {Stripe | null}
 */
export function getMppStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, {
    // @ts-expect-error preview API for crypto deposit / MPP
    apiVersion: "2026-03-25.preview",
    appInfo: {
      name: "TitanOS MPP",
      version: "1.5.4",
      url: "https://titanos-web.vercel.app",
    },
    maxNetworkRetries: 2,
    timeout: 20_000,
  });
}

export function isMppConfigured() {
  // Tempo crypto needs the secret key; SPT needs a profile_ network id (env or auto-discover).
  return Boolean(process.env.STRIPE_SECRET_KEY && getMppSecretKey());
}

/** True when env already has a well-formed profile_ id (SPT ready without discovery). */
export function hasEnvStripeProfileId() {
  return isValidStripeProfileId(process.env.STRIPE_PROFILE_ID);
}

/**
 * Resolve SPT networkId: prefer STRIPE_PROFILE_ID, else Stripe Profiles "me" API.
 * @returns {Promise<string | null>}
 */
export async function resolveStripeProfileId() {
  const fromEnv = String(process.env.STRIPE_PROFILE_ID || "").trim();
  if (isValidStripeProfileId(fromEnv)) return fromEnv;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  try {
    const res = await fetch("https://api.stripe.com/v2/network/business_profiles/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Stripe-Version": "2026-04-22.preview",
      },
    });
    if (!res.ok) return null;
    const body = await res.json();
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    return isValidStripeProfileId(id) ? id : null;
  } catch {
    return null;
  }
}

export function getMppChargeAmounts() {
  const tempoUsd = process.env.MPP_TEMPO_AMOUNT || "0.01";
  const stripeUsd = process.env.MPP_STRIPE_AMOUNT || "0.50";
  const tempoCents = usdToCents(tempoUsd, { minCents: 1, maxCents: 500, fallbackCents: 1 });
  const stripeCents = usdToCents(stripeUsd, { minCents: 50, maxCents: 10_000, fallbackCents: 50 });
  return {
    tempoUsd: (tempoCents / 100).toFixed(2),
    stripeUsd: (stripeCents / 100).toFixed(2),
    tempoCents,
    stripeCents,
  };
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

  const map = {
    MPP_RECIPIENT_MISSING: { status: 400, error: "Invalid payment credential", code },
    MPP_PAYTO_INVALID: { status: 400, error: "Invalid payTo address", code },
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
  };

  if (code && map[code]) return map[code];

  // Stripe SDK style
  if (code === "rate_limit" || statusHint === 429) {
    return { status: 429, error: "Too many payment requests. Try again shortly.", code: "rate_limit" };
  }
  if (statusHint === 401 || statusHint === 403) {
    return { status: 502, error: "Payment provider rejected the request", code: "provider_auth" };
  }
  if (statusHint >= 400 && statusHint < 500) {
    return { status: 400, error: "Invalid payment request", code: code || "bad_request" };
  }

  return { status: 500, error: "MPP payment handler failed", code: code || "mpp_internal" };
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
  const authHeader = request.headers.get("authorization");
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
    // Prefer cache hit (same instance). On cold/multi-instance miss, still accept a
    // well-formed recipient — Mppx.compose + secretKey verify the real payment.
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

  const stripeClient = getMppStripeClient();
  if (!stripeClient) {
    const err = new Error("STRIPE_SECRET_KEY required");
    err.code = "MPP_NOT_CONFIGURED";
    throw err;
  }

  const paymentIntent = await stripeClient.paymentIntents.create({
    amount: amountInCents,
    currency: "usd",
    payment_method_types: ["crypto"],
    payment_method_data: {
      type: "crypto",
    },
    payment_method_options: {
      crypto: {
        mode: "deposit",
        deposit_options: {
          networks: ["tempo"],
        },
      },
    },
    confirm: true,
  });

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
