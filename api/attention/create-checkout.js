import { getSupabaseAdmin } from "../_lib/supabase.js";

function json(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json(res, 503, { error: "Stripe is not configured for this deployment" });

  const authorization = String(req.headers.authorization || "");
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return json(res, 401, { error: "Authentication required" });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const campaignId = String(body.campaign_id || "");
  if (!campaignId) return json(res, 400, { error: "campaign_id is required" });

  try {
    const admin = getSupabaseAdmin();
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) return json(res, 401, { error: "Invalid session" });

    const { data: profile } = await admin
      .from("attention_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile || !["advertiser", "admin"].includes(profile.role)) {
      return json(res, 403, { error: "Advertiser account required" });
    }

    const { data: campaign, error: campaignError } = await admin
      .from("attention_campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("advertiser_id", user.id)
      .maybeSingle();
    if (campaignError || !campaign) return json(res, 404, { error: "Campaign not found" });
    if (campaign.status === "active" && Number(campaign.funded_cents) >= Number(campaign.total_budget_cents)) {
      return json(res, 409, { error: "Campaign is already funded" });
    }

    const amount = Number(campaign.total_budget_cents || 0);
    if (!Number.isInteger(amount) || amount < 500 || amount > 10_000_000) {
      return json(res, 400, { error: "Campaign budget must be between $5 and $100,000" });
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey);

    if (campaign.stripe_checkout_session_id) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(campaign.stripe_checkout_session_id);
        if (existing.status === "open" && existing.url) return json(res, 200, { url: existing.url, reused: true });
        if (existing.payment_status === "paid") return json(res, 409, { error: "Funding payment already completed" });
      } catch {
        // Create a fresh session below if the prior session is no longer usable.
      }
    }

    const origin = process.env.APP_ORIGIN || `https://${req.headers.host}`;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${origin}/?funding=success&campaign=${encodeURIComponent(campaign.id)}`,
      cancel_url: `${origin}/?funding=cancelled&campaign=${encodeURIComponent(campaign.id)}`,
      client_reference_id: campaign.id,
      customer_email: user.email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amount,
            product_data: {
              name: `Titan Attention campaign budget — ${campaign.title}`.slice(0, 120),
              description: "Prepaid direct sponsored-engagement campaign budget",
            },
          },
        },
      ],
      metadata: {
        kind: "attention_campaign_funding",
        campaign_id: campaign.id,
        advertiser_id: user.id,
        expected_amount_cents: String(amount),
      },
      payment_intent_data: {
        metadata: {
          kind: "attention_campaign_funding",
          campaign_id: campaign.id,
          advertiser_id: user.id,
          expected_amount_cents: String(amount),
        },
      },
    }, { idempotencyKey: `attention-fund-${campaign.id}-${amount}` });

    const { error: updateError } = await admin
      .from("attention_campaigns")
      .update({ stripe_checkout_session_id: session.id, status: "funding", updated_at: new Date().toISOString() })
      .eq("id", campaign.id)
      .eq("advertiser_id", user.id);
    if (updateError) {
      try { await stripe.checkout.sessions.expire(session.id); } catch { /* best effort */ }
      throw updateError;
    }

    return json(res, 200, { url: session.url });
  } catch (error) {
    console.error("attention:create-checkout", error);
    return json(res, 500, { error: "Unable to create campaign checkout" });
  }
}
