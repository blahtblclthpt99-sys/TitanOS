/**
 * PayPal REST helpers — OAuth + webhook signature verification.
 * Secrets: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID
 * Mode: PAYPAL_MODE=live|sandbox (default live)
 */

const LIVE_API = "https://api-m.paypal.com";
const SANDBOX_API = "https://api-m.sandbox.paypal.com";

export function paypalApiBase() {
  return String(process.env.PAYPAL_MODE || "live").toLowerCase() === "sandbox"
    ? SANDBOX_API
    : LIVE_API;
}

export function paypalConfigured() {
  return Boolean(
    process.env.PAYPAL_CLIENT_ID &&
      process.env.PAYPAL_CLIENT_SECRET &&
      process.env.PAYPAL_WEBHOOK_ID
  );
}

let cachedToken = { value: "", expiresAt: 0 };

export async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) {
    throw new Error("PayPal client credentials are not configured");
  }
  if (cachedToken.value && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.value;
  }
  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal OAuth failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 300) * 1000,
  };
  return cachedToken.value;
}

/**
 * Verify webhook using PayPal's verify-webhook-signature endpoint.
 * @param {{ headers: Record<string,string>, event: object }} args
 */
export async function verifyPayPalWebhook({ headers, event }) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error("PAYPAL_WEBHOOK_ID is not configured");

  const h = Object.fromEntries(
    Object.entries(headers || {}).map(([k, v]) => [String(k).toLowerCase(), v])
  );
  const transmissionId = h["paypal-transmission-id"];
  const transmissionTime = h["paypal-transmission-time"];
  const transmissionSig = h["paypal-transmission-sig"];
  const certUrl = h["paypal-cert-url"];
  const authAlgo = h["paypal-auth-algo"];

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    return { ok: false, reason: "missing_paypal_headers" };
  }

  // Only fetch/trust certs from PayPal domains (defense in depth even though we use API verify)
  try {
    const host = new URL(certUrl).hostname;
    if (!/(^|\.)paypal\.com$/i.test(host)) {
      return { ok: false, reason: "untrusted_cert_url" };
    }
  } catch {
    return { ok: false, reason: "invalid_cert_url" };
  }

  const token = await getPayPalAccessToken();
  const res = await fetch(`${paypalApiBase()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `verify_http_${res.status}`, detail: text.slice(0, 300) };
  }
  const data = await res.json();
  const status = String(data.verification_status || "").toUpperCase();
  return { ok: status === "SUCCESS", reason: status || "unknown", detail: data };
}

/** Map paid amount → TitanOS plan tier. */
export function planTierFromAmount(amount) {
  const n = Math.round(Number(amount) * 100) / 100;
  if (n === 29.99 || n === 29.9) return "worker_premium";
  if (n === 49.99 || n === 49.9) return "business";
  return null;
}

export function extractPayerEmail(resource = {}) {
  return (
    resource.payer?.email_address ||
    resource.payer?.payer_info?.email ||
    resource.payment_source?.paypal?.email_address ||
    resource.subscriber?.email_address ||
    null
  );
}

export function extractPaidAmount(resource = {}) {
  const candidates = [
    resource.amount?.value,
    resource.amount?.total,
    resource.purchase_units?.[0]?.amount?.value,
    resource.billing_info?.last_payment?.amount?.value,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}
