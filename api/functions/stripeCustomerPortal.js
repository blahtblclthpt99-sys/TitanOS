import Stripe from "stripe";
import { getSupabaseAdmin } from "../_lib/supabase.js";
import { applyCors, handleOptions, resolveAppOrigin } from "../_lib/cors.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { logError } from "../_lib/safeLog.js";

const TERMINAL_SUBSCRIPTION_STATUSES = new Set(["canceled", "incomplete_expired"]);
const STRIPE_TIMEOUT_MS = 10_000;

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  applyCors(res, req);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 8, windowMs: 60_000, key: "stripePortal" }))) return;

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: "Billing portal is not configured" });
    }

    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Authentication required" });

    const { data: rows, error: subscriptionError } = await admin
      .from("stripe_subscriptions")
      .select("stripe_customer_id,status,updated_at")
      .eq("user_id", data.user.id)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (subscriptionError) throw subscriptionError;

    const records = rows || [];
    const nonterminal = records.filter(
      (row) => !TERMINAL_SUBSCRIPTION_STATUSES.has(String(row.status || "").toLowerCase())
    );
    const nonterminalCustomerIds = [
      ...new Set(nonterminal.map((row) => String(row.stripe_customer_id || "").trim()).filter(Boolean)),
    ];

    if (nonterminalCustomerIds.length > 1) {
      logError("stripeCustomerPortal:multiple_billing_identities", {
        userId: data.user.id,
        nonterminalSubscriptions: nonterminal.length,
        distinctBillingIdentities: nonterminalCustomerIds.length,
      });
      return res.status(409).json({
        error: "Multiple active billing identities require support review before billing can be managed safely.",
        code: "MULTIPLE_SUBSCRIPTIONS_REQUIRES_REVIEW",
      });
    }

    const customerId =
      nonterminalCustomerIds[0] ||
      records.map((row) => String(row.stripe_customer_id || "").trim()).find(Boolean) ||
      null;
    if (!customerId) return res.status(404).json({ error: "No Stripe subscription found" });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      timeout: STRIPE_TIMEOUT_MS,
      maxNetworkRetries: 1,
    });
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${resolveAppOrigin(req)}/settings?panel=membership`,
    });
    return res.status(200).json({ url: portal.url });
  } catch (error) {
    logError("stripeCustomerPortal", { message: error?.message || String(error) });
    return res.status(500).json({ error: "Could not open billing portal" });
  }
}
