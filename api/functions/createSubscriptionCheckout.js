import Stripe from "stripe";
import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions, resolveAppOrigin } from "../_lib/cors.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import {
  membershipPaymentsEnabled,
  stripePlanCatalog,
  stripeSubscriptionsConfigured,
} from "../_lib/stripeSubscriptions.js";

function bearer(req) {
  return String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  applyCors(res, req);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 8, windowMs: 60_000, key: "subscriptionCheckout" }))) return;

  try {
    // Financial permission is distinct from having credentials configured.
    // Keep this check before auth/Stripe work so incident response can stop all
    // new membership checkout creation with one authoritative environment gate.
    if (!membershipPaymentsEnabled()) {
      return res.status(503).json({ error: "Membership checkout is not enabled" });
    }
    if (!stripeSubscriptionsConfigured()) {
      return res.status(503).json({ error: "Subscriptions are not configured yet" });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.getUser(bearer(req));
    if (error || !data?.user) return res.status(401).json({ error: "Authentication required" });

    const requested = String(readJson(req).planId || "");
    const planId = requested === "pro" ? "worker_premium" : requested;
    const priceId = stripePlanCatalog()[planId];
    if (!priceId) return res.status(400).json({ error: "Unknown subscription plan" });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin = resolveAppOrigin(req);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: data.user.email || undefined,
      client_reference_id: data.user.id,
      allow_promotion_codes: true,
      success_url: `${origin}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?checkout=canceled`,
      metadata: { user_id: data.user.id, plan_tier: planId },
      subscription_data: { metadata: { user_id: data.user.id, plan_tier: planId } },
    }, { idempotencyKey: `subscription_checkout_${data.user.id}_${planId}_${Math.floor(Date.now() / 300000)}` });

    return res.status(200).json({ url: session.url });
  } catch {
    return res.status(500).json({ error: "Could not start subscription checkout" });
  }
}
