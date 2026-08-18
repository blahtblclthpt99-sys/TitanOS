import { getSupabaseAdmin } from "../_lib/supabase.js";

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.body === "string") return Buffer.from(req.body);
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return chunks.length ? Buffer.concat(chunks) : null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) return res.status(503).json({ error: "Stripe webhook is not configured" });

  let event;
  try {
    const signature = req.headers["stripe-signature"];
    if (!signature) return res.status(400).json({ error: "Missing Stripe-Signature" });
    const rawBody = await readRawBody(req);
    if (!rawBody?.length) return res.status(400).json({ error: "Raw body required" });

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("attention:stripe-signature", error);
    return res.status(400).json({ error: "Invalid Stripe signature" });
  }

  const admin = getSupabaseAdmin();
  let claimed = false;

  try {
    const object = event.data?.object || {};
    const metadata = object.metadata || {};
    const campaignId = metadata.campaign_id || object.client_reference_id || null;

    const { error: claimError } = await admin.from("attention_payment_events").insert({
      event_id: event.id,
      event_type: event.type,
      object_id: object.id || null,
      campaign_id: campaignId || null,
    });
    if (claimError) {
      if (claimError.code === "23505" || /duplicate|unique/i.test(claimError.message || "")) {
        return res.status(200).json({ received: true, duplicate: true });
      }
      throw claimError;
    }
    claimed = true;

    if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
      if (metadata.kind !== "attention_campaign_funding") {
        return res.status(200).json({ received: true, ignored: true });
      }
      if (object.payment_status !== "paid") {
        return res.status(200).json({ received: true, waiting_for_payment: true });
      }

      const expected = Number(metadata.expected_amount_cents || 0);
      const paid = Number(object.amount_total || 0);
      if (!campaignId || !expected || expected !== paid) throw new Error("Campaign funding amount mismatch");

      const { data: campaign, error: campaignError } = await admin
        .from("attention_campaigns")
        .select("id,advertiser_id,total_budget_cents,stripe_checkout_session_id,status")
        .eq("id", campaignId)
        .maybeSingle();
      if (campaignError || !campaign) throw new Error("Campaign not found for funding webhook");
      if (String(campaign.advertiser_id) !== String(metadata.advertiser_id || "")) throw new Error("Campaign advertiser mismatch");
      if (Number(campaign.total_budget_cents) !== paid) throw new Error("Campaign budget mismatch");
      if (campaign.stripe_checkout_session_id && campaign.stripe_checkout_session_id !== object.id) throw new Error("Checkout session mismatch");

      const { error: activateError } = await admin.rpc("activate_attention_campaign_funding_service", {
        p_campaign_id: campaign.id,
        p_checkout_session_id: object.id,
        p_amount_cents: paid,
      });
      if (activateError) throw activateError;
    } else if (event.type === "checkout.session.expired" && metadata.kind === "attention_campaign_funding" && campaignId) {
      await admin
        .from("attention_campaigns")
        .update({ status: "draft", stripe_checkout_session_id: null, updated_at: new Date().toISOString() })
        .eq("id", campaignId)
        .eq("stripe_checkout_session_id", object.id)
        .eq("funded_cents", 0);
    } else if (["charge.refunded", "payment_intent.canceled"].includes(event.type) && metadata.kind === "attention_campaign_funding" && campaignId) {
      await admin
        .from("attention_campaigns")
        .update({ status: "paused", updated_at: new Date().toISOString() })
        .eq("id", campaignId);
    }

    return res.status(200).json({ received: true, type: event.type });
  } catch (error) {
    console.error("attention:stripe-webhook", error);
    if (claimed && event?.id) {
      try { await admin.from("attention_payment_events").delete().eq("event_id", event.id); } catch { /* Stripe can retry */ }
    }
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}
