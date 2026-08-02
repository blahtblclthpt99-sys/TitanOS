import Stripe from "stripe";
import { getSupabaseAdmin } from "../_lib/supabase.js";
import { applyCors, handleOptions, resolveAppOrigin } from "../_lib/cors.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  applyCors(res, req);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 8, windowMs: 60_000, key: "stripePortal" }))) return;
  try {
    if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: "Billing portal is not configured" });
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Authentication required" });
    const { data: record } = await admin.from("stripe_subscriptions")
      .select("stripe_customer_id").eq("user_id", data.user.id)
      .order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (!record?.stripe_customer_id) return res.status(404).json({ error: "No Stripe subscription found" });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const portal = await stripe.billingPortal.sessions.create({
      customer: record.stripe_customer_id,
      return_url: `${resolveAppOrigin(req)}/settings?panel=membership`,
    });
    return res.status(200).json({ url: portal.url });
  } catch {
    return res.status(500).json({ error: "Could not open billing portal" });
  }
}
