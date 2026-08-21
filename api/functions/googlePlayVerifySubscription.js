import crypto from "node:crypto";
import { readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { logError } from "../_lib/safeLog.js";

const PACKAGE_NAME = "com.titanos.myapp";
const PRODUCT_PLANS = Object.freeze({
  titanos_starter_monthly: "starter",
  titanos_pro_monthly: "worker_premium",
  titanos_business_monthly: "business",
});
const ENTITLED_STATES = new Set([
  "SUBSCRIPTION_STATE_ACTIVE",
  "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
  "SUBSCRIPTION_STATE_CANCELED",
]);

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}

function serviceAccount() {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Google Play verification is not configured");
  const parsed = JSON.parse(raw);
  if (!parsed.client_email || !parsed.private_key) throw new Error("Google Play service account is incomplete");
  return parsed;
}

async function accessToken() {
  const account = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), account.private_key).toString("base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new Error("Google Play authorization failed");
  return body.access_token;
}

async function googleRequest(url, token, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Google Play API request failed (${response.status})`);
  return body;
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

async function claimReceipt(auth, row) {
  // purchase_token is the primary key. An INSERT is the atomic ownership claim:
  // two users racing the same fresh token cannot both become its owner.
  const { error: insertError } = await auth.admin
    .from("google_play_subscriptions")
    .insert(row);
  if (!insertError) return { claimed: true };
  if (insertError.code !== "23505") throw insertError;

  // The token already exists. Re-read after the unique-key conflict rather than
  // trusting the preflight lookup, which can race with another verifier.
  const { data: existing, error: existingError } = await auth.admin
    .from("google_play_subscriptions")
    .select("user_id")
    .eq("purchase_token", row.purchase_token)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw insertError;
  if (existing.user_id !== auth.user.id) return { claimed: false };

  // Same owner: refresh only receipt state. Never update user_id during a
  // duplicate-token path, and scope the update by both token and owner.
  const refresh = {
    product_id: row.product_id,
    base_plan_id: row.base_plan_id,
    subscription_state: row.subscription_state,
    expires_at: row.expires_at,
    auto_renewing: row.auto_renewing,
    acknowledged: row.acknowledged,
    linked_purchase_token: row.linked_purchase_token,
    last_verified_at: row.last_verified_at,
  };
  const { error: refreshError } = await auth.admin
    .from("google_play_subscriptions")
    .update(refresh)
    .eq("purchase_token", row.purchase_token)
    .eq("user_id", auth.user.id);
  if (refreshError) throw refreshError;
  return { claimed: true };
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!assertRateLimit(req, res, { limit: 10, windowMs: 60_000, key: "googlePlayVerifySubscription" })) return;
  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const body = readJson(req);
    const packageName = String(body.packageName || "");
    const productId = String(body.productId || "");
    const purchaseToken = String(body.purchaseToken || "");
    if (packageName !== PACKAGE_NAME || !PRODUCT_PLANS[productId] || purchaseToken.length < 20 || purchaseToken.length > 4096) {
      return res.status(400).json({ error: "Invalid Google Play purchase" });
    }

    const { data: claimed, error: claimedError } = await auth.admin.from("google_play_subscriptions")
      .select("user_id").eq("purchase_token", purchaseToken).maybeSingle();
    if (claimedError) throw claimedError;
    if (claimed && claimed.user_id !== auth.user.id) return res.status(409).json({ error: "Purchase is linked to another account" });

    const token = await accessToken();
    const encoded = encodeURIComponent(purchaseToken);
    const purchase = await googleRequest(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${encoded}`,
      token
    );
    const state = String(purchase.subscriptionState || "");
    const line = (purchase.lineItems || []).find((item) => item.productId === productId);
    const expiresAt = line?.expiryTime ? new Date(line.expiryTime) : null;
    const accountId = purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId;
    const active = ENTITLED_STATES.has(state) && expiresAt && expiresAt.getTime() > Date.now();
    if (!line || !active || (accountId && accountId !== sha256(auth.user.id))) {
      return res.status(403).json({ error: "Google Play purchase is not active for this account" });
    }

    let acknowledged = purchase.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";
    if (!acknowledged) {
      await googleRequest(
        `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encoded}:acknowledge`,
        token,
        { method: "POST", body: JSON.stringify({}) }
      );
      acknowledged = true;
    }

    const basePlanId = line.offerDetails?.basePlanId || null;
    const autoRenewing = line.autoRenewingPlan?.autoRenewEnabled === true;
    const row = {
      purchase_token: purchaseToken,
      user_id: auth.user.id,
      product_id: productId,
      base_plan_id: basePlanId,
      subscription_state: state,
      expires_at: expiresAt.toISOString(),
      auto_renewing: autoRenewing,
      acknowledged,
      linked_purchase_token: purchase.linkedPurchaseToken || null,
      last_verified_at: new Date().toISOString(),
    };
    const receiptClaim = await claimReceipt(auth, row);
    if (!receiptClaim.claimed) return res.status(409).json({ error: "Purchase is linked to another account" });

    const planTier = PRODUCT_PLANS[productId];
    const { data: profile, error: profileError } = await auth.admin.from("profiles")
      .update({ plan_tier: planTier, is_pro: true, paying_subscriber: true })
      .eq("id", auth.user.id)
      .select("id, plan_tier, is_pro, paying_subscriber").single();
    if (profileError) throw profileError;

    return res.status(200).json({ verified: true, entitlement: profile, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    logError("googlePlayVerifySubscription", error);
    const unavailable = /not configured|incomplete/.test(error?.message || "");
    return res.status(unavailable ? 503 : 502).json({ error: unavailable ? "Google Play verification is being configured" : "Could not verify Google Play purchase" });
  }
}
