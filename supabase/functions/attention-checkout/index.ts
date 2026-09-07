import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@22.3.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_CHARS = 8_192;
const CAMPAIGN_FIELDS = "id,advertiser_id,title,total_budget_cents,funded_cents,status,stripe_checkout_session_id,updated_at";

const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";

const admin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!admin || !stripeSecretKey || !supabaseUrl) return json({ error: "service_unavailable" }, 503);

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const token = authorization.slice(7).trim();
  if (!token) return json({ error: "unauthorized" }, 401);

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (!raw || raw.length > MAX_BODY_CHARS) return json({ error: "invalid_request_size" }, 413);
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid_json_shape");
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const campaignId = String(body.campaign_id || "").trim();
  if (!UUID_RE.test(campaignId)) return json({ error: "invalid_campaign_id" }, 400);

  try {
    const { data: profile, error: profileError } = await admin
      .from("attention_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || !["advertiser", "admin"].includes(profile.role)) {
      return json({ error: "advertiser_required" }, 403);
    }

    const { data: campaign, error: campaignError } = await admin
      .from("attention_campaigns")
      .select(CAMPAIGN_FIELDS)
      .eq("id", campaignId)
      .eq("advertiser_id", user.id)
      .maybeSingle();
    if (campaignError) throw campaignError;
    if (!campaign) return json({ error: "campaign_not_found" }, 404);

    if (campaign.status === "active" && Number(campaign.funded_cents) >= Number(campaign.total_budget_cents)) {
      return json({ error: "campaign_already_funded" }, 409);
    }

    const amount = Number(campaign.total_budget_cents || 0);
    if (!Number.isInteger(amount) || amount < 500 || amount > 10_000_000) {
      return json({ error: "invalid_campaign_budget" }, 400);
    }

    const stripe = new Stripe(stripeSecretKey);

    if (campaign.stripe_checkout_session_id) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(campaign.stripe_checkout_session_id);
        if (existing.status === "open" && existing.url) {
          return json({ url: existing.url, reused: true });
        }
        if (existing.payment_status === "paid") {
          return json({ error: "funding_payment_already_completed" }, 409);
        }
      } catch {
        // Missing/expired sessions are safely replaced below.
      }
    }

    const returnBase = `${supabaseUrl}/functions/v1/attention-checkout-return`;
    const campaignQuery = encodeURIComponent(campaign.id);
    const successUrl = `${returnBase}?status=success&campaign=${campaignQuery}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${returnBase}?status=cancelled&campaign=${campaignQuery}`;
    const campaignVersion = Number.isFinite(Date.parse(campaign.updated_at)) ? Date.parse(campaign.updated_at) : 0;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
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
    }, {
      idempotencyKey: `attention-fund-${campaign.id}-${amount}-${campaignVersion}`,
    });

    if (!session.url) return json({ error: "checkout_url_unavailable" }, 502);

    const { error: updateError } = await admin
      .from("attention_campaigns")
      .update({
        stripe_checkout_session_id: session.id,
        status: "funding",
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign.id)
      .eq("advertiser_id", user.id);

    if (updateError) {
      try {
        await stripe.checkout.sessions.expire(session.id);
      } catch {
        // Best effort only; the database remains authoritative for activation.
      }
      throw updateError;
    }

    return json({ url: session.url });
  } catch (error) {
    console.error("attention-checkout", error);
    return json({ error: "checkout_failed" }, 500);
  }
});
