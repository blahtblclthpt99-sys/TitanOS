import { getSupabaseAdmin } from "../_lib/supabase.js";

export const config = { api: { bodyParser: false } };

const FUNDING_KIND = "attention_campaign_funding";
const FUNDING_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.expired",
  "charge.refunded",
  "payment_intent.canceled",
]);

async function readRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.body === "string") return Buffer.from(req.body);
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return chunks.length ? Buffer.concat(chunks) : null;
}

function isDuplicate(error) {
  return error?.code === "23505" || /duplicate|unique/i.test(error?.message || "");
}

async function resolveFundingMetadata(stripe, event) {
  const object = event.data?.object || {};
  let metadata = object.metadata || {};

  // PaymentIntent metadata is not guaranteed to be present on the Charge object.
  // Recover it authoritatively before processing a refund.
  if (
    event.type === "charge.refunded" &&
    (metadata.kind !== FUNDING_KIND || !metadata.campaign_id) &&
    object.payment_intent
  ) {
    const paymentIntentId =
      typeof object.payment_intent === "string" ? object.payment_intent : object.payment_intent?.id;
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

async function requireUpdate(result, label) {
  if (result?.error) {
    const error = new Error(`${label}: ${result.error.message || "database update failed"}`);
    error.cause = result.error;
    throw error;
  }
  return result;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) return res.status(503).json({ error: "Stripe webhook is not configured" });

  let event;
  let stripe;
  try {
    const signature = req.headers["stripe-signature"];
    if (!signature) return res.status(400).json({ error: "Missing Stripe-Signature" });
    const rawBody = await readRawBody(req);
    if (!rawBody?.length) return res.status(400).json({ error: "Raw body required" });

    const Stripe = (await import("stripe")).default;
    stripe = new Stripe(stripeKey);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("attention:stripe-signature", error);
    return res.status(400).json({ error: "Invalid Stripe signature" });
  }

  // This endpoint may share a Stripe account with other products. Ignore event
  // families that Titan Attention can never use before touching its event ledger.
  if (!FUNDING_EVENTS.has(event.type)) {
    return res.status(200).json({ received: true, ignored: true, type: event.type });
  }

  const admin = getSupabaseAdmin();
  let claimed = false;

  try {
    const { object, metadata, campaignId } = await resolveFundingMetadata(stripe, event);

    // Relevant Stripe event type, but not a Titan Attention funding object.
    if (metadata.kind !== FUNDING_KIND) {
      return res.status(200).json({ received: true, ignored: true, type: event.type });
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
        return res.status(200).json({ received: true, duplicate: true, type: event.type });
      }
      throw claimError;
    }
    claimed = true;

    if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
      if (object.payment_status !== "paid") {
        return res.status(200).json({ received: true, waiting_for_payment: true, type: event.type });
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
      await requireUpdate(
        await admin
          .from("attention_campaigns")
          .update({ status: "draft", stripe_checkout_session_id: null, updated_at: new Date().toISOString() })
          .eq("id", campaignId)
          .eq("stripe_checkout_session_id", object.id)
          .eq("funded_cents", 0),
        "expire campaign funding"
      );
    } else if (["charge.refunded", "payment_intent.canceled"].includes(event.type)) {
      // A refund/cancellation makes continued delivery unsafe. Pause first; an
      // operator or explicit reconciliation flow can decide whether to resume.
      await requireUpdate(
        await admin
          .from("attention_campaigns")
          .update({ status: "paused", updated_at: new Date().toISOString() })
          .eq("id", campaignId),
        "pause reversed campaign funding"
      );
    }

    return res.status(200).json({ received: true, type: event.type });
  } catch (error) {
    console.error("attention:stripe-webhook", error);
    if (claimed && event?.id) {
      try {
        // Release the claim only when processing failed so Stripe's retry can
        // re-enter the state transition. A failure to release still returns 500.
        const release = await admin.from("attention_payment_events").delete().eq("event_id", event.id);
        if (release?.error) console.error("attention:stripe-webhook-release", release.error);
      } catch (releaseError) {
        console.error("attention:stripe-webhook-release", releaseError);
      }
    }
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}
