import { getSupabaseAdmin } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";
import {
  extractPaidAmount,
  extractPayerEmail,
  paypalConfigured,
  planTierFromAmount,
  verifyPayPalWebhook,
} from "../_lib/paypal.js";

/**
 * PayPal webhook — upgrades membership after verified NCP / Checkout payment.
 *
 * Point PayPal Developer → Webhooks at:
 *   https://titanos-web.vercel.app/api/functions/paypalWebhook
 *
 * Required env (Vercel, server-only — never VITE_*):
 *   PAYPAL_CLIENT_ID
 *   PAYPAL_CLIENT_SECRET
 *   PAYPAL_WEBHOOK_ID
 *   PAYPAL_MODE=live (or sandbox)
 *
 * Note: The classic PayPal "live_api" public PEM certificate is NOT used here.
 * Modern webhooks verify via PayPal's verify-webhook-signature API (cert URL in headers).
 * Never paste a PayPal PRIVATE key into chat or the repo.
 *
 * User matching: payer email must match a TitanOS profiles.email (case-insensitive).
 */

export const config = {
  api: {
    bodyParser: true,
  },
};

async function upgradeProfileByEmail(admin, email, planTier, eventId) {
  if (!email || !planTier) return { updated: false, reason: "missing_email_or_plan" };
  const normalized = String(email).trim().toLowerCase();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, email, plan_tier, paying_subscriber")
    .ilike("email", normalized)
    .limit(5);
  if (error) throw error;
  if (!profiles?.length) return { updated: false, reason: "no_profile_for_email", email: normalized };

  const patch = {
    plan_tier: planTier,
    paying_subscriber: true,
    is_pro: true,
    updated_at: new Date().toISOString(),
  };
  if (planTier === "business") {
    patch.account_type = "business";
  } else if (planTier === "worker_premium") {
    patch.account_type = "worker";
  }

  const ids = profiles.map((p) => p.id);
  const { error: upErr } = await admin.from("profiles").update(patch).in("id", ids);
  if (upErr) throw upErr;

  return {
    updated: true,
    planTier,
    userIds: ids,
    eventId,
  };
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!assertRateLimit(req, res, { limit: 300, windowMs: 60_000, key: "paypalWebhook" })) return;

  if (!paypalConfigured()) {
    return res.status(503).json({
      error:
        "PayPal webhook not configured. Set PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, and PAYPAL_WEBHOOK_ID.",
    });
  }

  try {
    const event =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body && typeof req.body === "object"
          ? req.body
          : {};

    if (!event?.id || !event?.event_type) {
      return res.status(400).json({ error: "Invalid PayPal event payload" });
    }

    const verified = await verifyPayPalWebhook({ headers: req.headers, event });
    if (!verified.ok) {
      logError("paypalWebhook:signature", verified);
      return res.status(400).json({ error: "Invalid PayPal signature", reason: verified.reason });
    }

    const admin = getSupabaseAdmin();
    let idempotencyClaimed = false;

    try {
      const { error: idemErr } = await admin.from("paypal_webhook_events").insert({
        event_id: event.id,
        event_type: event.event_type,
        payload_summary: {
          type: event.event_type,
          resource_id: event.resource?.id || null,
          summary: event.summary || null,
        },
      });
      if (idemErr) {
        if (idemErr.code === "23505" || /duplicate|unique/i.test(idemErr.message || "")) {
          return res.status(200).json({ received: true, type: event.event_type, duplicate: true });
        }
        if (idemErr.code === "42P01" || /does not exist|relation/i.test(idemErr.message || "")) {
          logError("paypalWebhook:idempotency_table_missing", idemErr);
          return res.status(503).json({
            error: "paypal_webhook_events table missing. Apply migration 027_paypal_webhook_events.sql",
          });
        }
        throw idemErr;
      }
      idempotencyClaimed = true;
    } catch (idemCatch) {
      logError("paypalWebhook:idempotency", idemCatch);
      return res.status(500).json({ error: "Webhook idempotency failed" });
    }

    try {
      const type = String(event.event_type || "");
      const resource = event.resource || {};
      const moneyEvents = new Set([
        // Settled funds only — never grant premium on ORDER.APPROVED (pre-capture).
        "PAYMENT.CAPTURE.COMPLETED",
        "CHECKOUT.ORDER.COMPLETED",
        "PAYMENT.SALE.COMPLETED",
      ]);

      if (!moneyEvents.has(type)) {
        return res.status(200).json({ received: true, type, ignored: true });
      }

      const amount = extractPaidAmount(resource);
      const planTier = planTierFromAmount(amount);
      if (!planTier) {
        return res.status(200).json({
          received: true,
          type,
          ignored: "unmapped_amount",
          amount,
        });
      }

      const email = extractPayerEmail(resource);
      const result = await upgradeProfileByEmail(admin, email, planTier, event.id);

      return res.status(200).json({
        received: true,
        type,
        amount,
        planTier,
        ...result,
      });
    } catch (processErr) {
      if (idempotencyClaimed && event.id) {
        try {
          await admin.from("paypal_webhook_events").delete().eq("event_id", event.id);
        } catch {
          /* allow PayPal retry */
        }
      }
      throw processErr;
    }
  } catch (error) {
    logError("paypalWebhook", error);
    captureApiException(error, { tags: { route: "paypalWebhook" } });
    return res.status(500).json({ error: "PayPal webhook handler failed" });
  }
}
