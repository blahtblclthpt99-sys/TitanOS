import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const FUNDING_KIND = "attention_campaign_funding";
const FUNDING_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.expired",
  "charge.refunded",
  "payment_intent.canceled",
]);

function json(status, body, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function normalizeSupabaseUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/\/(rest|auth)\/v1\/?$/i, "").replace(/\/$/, "");
}

function getSupabaseAdmin(env) {
  const url = normalizeSupabaseUrl(env.SUPABASE_URL);
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function getStripe(env) {
  const key = String(env.STRIPE_SECRET_KEY || "").trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is required");
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
}

function appOrigin(request, env) {
  const configured = String(env.APP_ORIGIN || "").trim();
  const candidate = configured || new URL(request.url).origin;
  let parsed;

  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("APP_ORIGIN is invalid");
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  ) {
    throw new Error("APP_ORIGIN must be a clean HTTPS origin");
  }

  return parsed.origin;
}

function bearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

function isMissingStripeResource(error) {
  return error?.type === "StripeInvalidRequestError" && error?.code === "resource_missing";
}

function isDuplicate(error) {
  return error?.code === "23505" || /duplicate|unique/i.test(error?.message || "");
}

async function requireDatabaseUpdate(result, label) {
  if (result?.error) {
    const error = new Error(`${label}: ${result.error.message || "database update failed"}`);
    error.cause = result.error;
    throw error;
  }
  return result;
}

async function resolveFundingMetadata(stripe, event) {
  const object = event.data?.object || {};
  let metadata = object.metadata || {};

  if (
    event.type === "charge.refunded" &&
    (metadata.kind !== FUNDING_KIND || !metadata.campaign_id) &&
    object.payment_intent
  ) {
    const paymentIntentId =
      typeof object.payment_intent === "string"
        ? object.payment_intent
        : object.payment_intent?.id;

    if (paymentIntentId) {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      metadata = paymentIntent?.metadata || metadata;
    }
  }

  return {
    object,
    metadata,
    campaignId: metadata.campaign_id || object.client_reference_id || null,
  };
}

export async function createAttentionCheckout(request, env) {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!env.STRIPE_SECRET_KEY) return json(503, { error: "Stripe is not configured for this deployment" });

  const token = bearerToken(request);
  if (!token) return json(401, { error: "Authentication required" });

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Valid JSON body required" });
  }

  const campaignId = String(body?.campaign_id || "").trim();
  if (!campaignId) return json(400, { error: "campaign_id is required" });

  try {
    const admin = getSupabaseAdmin(env);
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) return json(401, { error: "Invalid session" });

    const { data: profile, error: profileError } = await admin
      .from("attention_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || !["advertiser", "admin"].includes(profile.role)) {
      return json(403, { error: "Advertiser account required" });
    }

    const { data: campaign, error: campaignError } = await admin
      .from("attention_campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("advertiser_id", user.id)
      .maybeSingle();
    if (campaignError) throw campaignError;
    if (!campaign) return json(404, { error: "Campaign not found" });

    if (
      campaign.status === "active" &&
      Number(campaign.funded_cents) >= Number(campaign.total_budget_cents)
    ) {
      return json(409, { error: "Campaign is already funded" });
    }

    const amount = Number(campaign.total_budget_cents || 0);
    if (!Number.isInteger(amount) || amount < 500 || amount > 10_000_000) {
      return json(400, { error: "Campaign budget must be between $5 and $100,000" });
    }

    const stripe = getStripe(env);

    if (campaign.stripe_checkout_session_id) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(campaign.stripe_checkout_session_id);
        if (existing.status === "open" && existing.url) {
          return json(200, { url: existing.url, reused: true });
        }
        if (existing.payment_status === "paid") {
          return json(409, { error: "Funding payment already completed" });
        }
      } catch (error) {
        if (!isMissingStripeResource(error)) throw error;
      }
    }

    const origin = appOrigin(request, env);
    const campaignVersion = Number.isFinite(Date.parse(campaign.updated_at))
      ? Date.parse(campaign.updated_at)
      : 0;

    const session = await stripe.checkout.sessions.create(
      {
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
          kind: FUNDING_KIND,
          campaign_id: campaign.id,
          advertiser_id: user.id,
          expected_amount_cents: String(amount),
        },
        payment_intent_data: {
          metadata: {
            kind: FUNDING_KIND,
            campaign_id: campaign.id,
            advertiser_id: user.id,
            expected_amount_cents: String(amount),
          },
        },
      },
      { idempotencyKey: `attention-fund-${campaign.id}-${amount}-${campaignVersion}` },
    );

    if (!session?.id || !session?.url) throw new Error("Stripe checkout session was incomplete");

    const { data: updatedCampaign, error: updateError } = await admin
      .from("attention_campaigns")
      .update({
        stripe_checkout_session_id: session.id,
        status: "funding",
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign.id)
      .eq("advertiser_id", user.id)
      .eq("funded_cents", Number(campaign.funded_cents || 0))
      .select("id")
      .maybeSingle();

    if (updateError || !updatedCampaign) {
      try {
        await stripe.checkout.sessions.expire(session.id);
      } catch {
        // Best effort only; the guarded database write remains authoritative.
      }
      if (updateError) throw updateError;
      throw new Error("Campaign changed while checkout was being created");
    }

    return json(200, { url: session.url });
  } catch (error) {
    console.error("attention:create-checkout", error);
    return json(500, { error: "Unable to create campaign checkout" });
  }
}

export async function handleAttentionStripeWebhook(request, env) {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  const webhookSecret = String(env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!env.STRIPE_SECRET_KEY || !webhookSecret) {
    return json(503, { error: "Stripe webhook is not configured" });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return json(400, { error: "Missing Stripe-Signature" });

  let event;
  let stripe;
  try {
    const rawBody = await request.text();
    if (!rawBody) return json(400, { error: "Raw body required" });

    stripe = getStripe(env);
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (error) {
    console.error("attention:stripe-signature", error);
    return json(400, { error: "Invalid Stripe signature" });
  }

  if (!FUNDING_EVENTS.has(event.type)) {
    return json(200, { received: true, ignored: true, type: event.type });
  }

  const admin = getSupabaseAdmin(env);
  let claimed = false;

  try {
    const { object, metadata, campaignId } = await resolveFundingMetadata(stripe, event);

    if (metadata.kind !== FUNDING_KIND) {
      return json(200, { received: true, ignored: true, type: event.type });
    }
    if (!campaignId) throw new Error("Campaign funding event is missing campaign_id");

    const { error: claimError } = await admin.from("attention_payment_events").insert({
      event_id: event.id,
      event_type: event.type,
      object_id: object.id || null,
      campaign_id: campaignId,
    });

    if (claimError) {
      if (isDuplicate(claimError)) {
        return json(200, { received: true, duplicate: true, type: event.type });
      }
      throw claimError;
    }
    claimed = true;

    if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
      if (object.payment_status !== "paid") {
        return json(200, { received: true, waiting_for_payment: true, type: event.type });
      }

      const expected = Number(metadata.expected_amount_cents || 0);
      const paid = Number(object.amount_total || 0);
      if (!Number.isInteger(expected) || expected <= 0 || expected !== paid) {
        throw new Error("Campaign funding amount mismatch");
      }

      const { data: campaign, error: campaignError } = await admin
        .from("attention_campaigns")
        .select("id,advertiser_id,total_budget_cents,stripe_checkout_session_id,status,funded_cents")
        .eq("id", campaignId)
        .maybeSingle();
      if (campaignError || !campaign) throw new Error("Campaign not found for funding webhook");
      if (String(campaign.advertiser_id) !== String(metadata.advertiser_id || "")) {
        throw new Error("Campaign advertiser mismatch");
      }
      if (Number(campaign.total_budget_cents) !== paid) throw new Error("Campaign budget mismatch");
      if (campaign.stripe_checkout_session_id && campaign.stripe_checkout_session_id !== object.id) {
        throw new Error("Checkout session mismatch");
      }

      const { error: activateError } = await admin.rpc("activate_attention_campaign_funding_service", {
        p_campaign_id: campaign.id,
        p_checkout_session_id: object.id,
        p_amount_cents: paid,
      });
      if (activateError) throw activateError;
    } else if (event.type === "checkout.session.expired") {
      await requireDatabaseUpdate(
        await admin
          .from("attention_campaigns")
          .update({
            status: "draft",
            stripe_checkout_session_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", campaignId)
          .eq("stripe_checkout_session_id", object.id)
          .eq("funded_cents", 0),
        "expire campaign funding",
      );
    } else if (["charge.refunded", "payment_intent.canceled"].includes(event.type)) {
      await requireDatabaseUpdate(
        await admin
          .from("attention_campaigns")
          .update({ status: "paused", updated_at: new Date().toISOString() })
          .eq("id", campaignId),
        "pause reversed campaign funding",
      );
    }

    return json(200, { received: true, type: event.type });
  } catch (error) {
    console.error("attention:stripe-webhook", error);
    if (claimed && event?.id) {
      try {
        const release = await admin.from("attention_payment_events").delete().eq("event_id", event.id);
        if (release?.error) console.error("attention:stripe-webhook-release", release.error);
      } catch (releaseError) {
        console.error("attention:stripe-webhook-release", releaseError);
      }
    }
    return json(500, { error: "Webhook processing failed" });
  }
}
