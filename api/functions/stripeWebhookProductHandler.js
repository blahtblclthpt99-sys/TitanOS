import { getSupabaseAdmin } from "../_lib/supabase.js";

export const config = { api: { bodyParser: false } };

const AUTOPILOT_TASK = "invoice_recovery_sprint";
const AUTOPILOT_PRICE_CENTS = 900;
const AUTOPILOT_EVENT_LEASE_MS = 5 * 60 * 1000;

async function readRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.body === "string") return Buffer.from(req.body);
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return chunks.length ? Buffer.concat(chunks) : null;
}

function sameId(a, b) {
  return String(a || "") === String(b || "");
}

function isDuplicateError(error) {
  return error?.code === "23505" || /duplicate|unique/i.test(error?.message || "");
}

function uuidOrNull(value) {
  const normalized = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
    ? normalized
    : null;
}

function parseAutopilotOrder(note = "") {
  if (!String(note).startsWith("AUTOPILOT:")) return null;
  try {
    return JSON.parse(String(note).slice("AUTOPILOT:".length));
  } catch {
    return null;
  }
}

function safeLedgerError(error) {
  return String(error?.code || error?.name || "processing_failed").slice(0, 120);
}

async function claimAutopilotEvent(admin, event, object) {
  const now = new Date().toISOString();
  const summary = {
    object_id: object?.id || null,
    task_type: AUTOPILOT_TASK,
  };
  const paymentId = uuidOrNull(object?.metadata?.payment_id);

  const { data: inserted, error: insertError } = await admin
    .from("stripe_webhook_events")
    .insert({
      event_id: event.id,
      event_type: event.type,
      processed_at: now,
      payment_id: paymentId,
      payload_summary: summary,
      processing_status: "processing",
      claimed_at: now,
      attempt_count: 1,
      last_error: null,
    })
    .select("event_id,processing_status,claimed_at,attempt_count")
    .maybeSingle();

  if (!insertError && inserted) {
    return { acquired: true, claimedAt: inserted.claimed_at, attemptCount: inserted.attempt_count };
  }
  if (insertError && !isDuplicateError(insertError)) throw insertError;

  const { data: existing, error: existingError } = await admin
    .from("stripe_webhook_events")
    .select("event_id,processing_status,claimed_at,attempt_count")
    .eq("event_id", event.id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new Error("Stripe event claim disappeared during duplicate reconciliation");

  if (existing.processing_status === "processed") {
    return { duplicate: true, processed: true };
  }

  const claimedMs = new Date(existing.claimed_at).getTime();
  const leaseFresh =
    existing.processing_status === "processing" &&
    Number.isFinite(claimedMs) &&
    Date.now() - claimedMs < AUTOPILOT_EVENT_LEASE_MS;
  if (leaseFresh) return { busy: true };

  const reclaimedAt = new Date().toISOString();
  let reclaim = admin
    .from("stripe_webhook_events")
    .update({
      processing_status: "processing",
      claimed_at: reclaimedAt,
      attempt_count: Math.max(1, Number(existing.attempt_count || 0) + 1),
      last_error: null,
      event_type: event.type,
      payment_id: paymentId,
      payload_summary: summary,
    })
    .eq("event_id", event.id)
    .eq("processing_status", existing.processing_status);
  if (existing.claimed_at) reclaim = reclaim.eq("claimed_at", existing.claimed_at);

  const { data: reclaimed, error: reclaimError } = await reclaim
    .select("event_id,processing_status,claimed_at,attempt_count")
    .maybeSingle();
  if (reclaimError) throw reclaimError;
  if (!reclaimed) return { busy: true };

  return {
    acquired: true,
    recovered: true,
    claimedAt: reclaimed.claimed_at,
    attemptCount: reclaimed.attempt_count,
  };
}

async function completeAutopilotEvent(admin, eventId, claimedAt) {
  const { data: completed, error } = await admin
    .from("stripe_webhook_events")
    .update({
      processing_status: "processed",
      processed_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("event_id", eventId)
    .eq("processing_status", "processing")
    .eq("claimed_at", claimedAt)
    .select("event_id")
    .maybeSingle();
  if (error) throw error;
  if (completed) return true;

  const { data: current, error: currentError } = await admin
    .from("stripe_webhook_events")
    .select("processing_status")
    .eq("event_id", eventId)
    .maybeSingle();
  if (currentError) throw currentError;
  if (current?.processing_status === "processed") return true;
  throw new Error("Stripe event lease changed before processing could be committed");
}

async function failAutopilotEvent(admin, eventId, claimedAt, error) {
  const { error: failError } = await admin
    .from("stripe_webhook_events")
    .update({
      processing_status: "failed",
      last_error: safeLedgerError(error),
    })
    .eq("event_id", eventId)
    .eq("processing_status", "processing")
    .eq("claimed_at", claimedAt);
  if (failError) console.error("stripe:autopilot_claim_fail", failError);
}

async function readValidatedAutopilotPayment(admin, session) {
  const metadata = session?.metadata || {};
  const paymentId = String(metadata.payment_id || "").trim();
  const expectedUserId = String(metadata.user_id || "").trim();
  if (!paymentId || !expectedUserId) throw new Error("Autopilot checkout metadata is incomplete");

  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .select("id,user_id,created_by_id,amount,currency,provider,status,external_id,note")
    .eq("id", paymentId)
    .maybeSingle();
  if (paymentError) throw paymentError;
  if (!payment) throw new Error("Autopilot payment record was not found");

  if (!sameId(payment.user_id, expectedUserId)) throw new Error("Autopilot payment user mismatch");
  if (payment.created_by_id && !sameId(payment.created_by_id, expectedUserId)) {
    throw new Error("Autopilot payment creator mismatch");
  }
  if (String(payment.provider || "").toLowerCase() !== "stripe") {
    throw new Error("Autopilot payment provider mismatch");
  }
  if (String(payment.currency || "").toLowerCase() !== "usd") {
    throw new Error("Autopilot payment currency mismatch");
  }
  if (session.currency && String(session.currency).toLowerCase() !== "usd") {
    throw new Error("Autopilot checkout currency mismatch");
  }
  if (payment.external_id && !sameId(payment.external_id, session.id)) {
    throw new Error("Autopilot checkout session mismatch");
  }

  const order = parseAutopilotOrder(payment.note);
  if (!order || order.type !== AUTOPILOT_TASK) throw new Error("Autopilot local order contract mismatch");
  if (!Array.isArray(order.invoice_ids) || order.invoice_ids.length < 1 || order.invoice_ids.length > 10) {
    throw new Error("Autopilot local order invoice batch is invalid");
  }

  const expectedCents = Math.round(Number(payment.amount || 0) * 100);
  const paidCents = Number(session.amount_total || 0);
  if (
    expectedCents !== AUTOPILOT_PRICE_CENTS ||
    Number(order.price_cents) !== AUTOPILOT_PRICE_CENTS ||
    paidCents !== AUTOPILOT_PRICE_CENTS
  ) {
    throw new Error("Autopilot checkout amount mismatch");
  }

  return { payment, order, expectedUserId };
}

function guardAutopilotPaymentMutation(query, payment) {
  let guarded = query
    .eq("id", payment.id)
    .eq("user_id", payment.user_id)
    .eq("amount", payment.amount)
    .eq("currency", payment.currency)
    .eq("provider", payment.provider)
    .eq("note", payment.note);
  guarded = payment.created_by_id
    ? guarded.eq("created_by_id", payment.created_by_id)
    : guarded.is("created_by_id", null);
  guarded = payment.external_id
    ? guarded.eq("external_id", payment.external_id)
    : guarded.is("external_id", null);
  return guarded;
}

async function settleAutopilotCheckout(admin, session) {
  const { payment } = await readValidatedAutopilotPayment(admin, session);

  if (session.payment_status !== "paid") {
    return { received: true, waiting_for_payment: true, product: "titan_autopilot" };
  }
  if (payment.status === "succeeded") {
    return { received: true, duplicate: true, product: "titan_autopilot" };
  }

  let settleMutation = admin
    .from("payments")
    .update({
      status: "succeeded",
      external_id: session.id || payment.external_id || null,
      updated_at: new Date().toISOString(),
    })
    .neq("status", "succeeded");
  settleMutation = guardAutopilotPaymentMutation(settleMutation, payment);

  const { data: settled, error: updateError } = await settleMutation
    .select("id,status")
    .maybeSingle();
  if (updateError) throw updateError;
  if (settled?.status === "succeeded") {
    return { received: true, settled: true, product: "titan_autopilot" };
  }

  const { data: current, error: currentError } = await admin
    .from("payments")
    .select("status")
    .eq("id", payment.id)
    .maybeSingle();
  if (currentError) throw currentError;
  if (current?.status === "succeeded") {
    return { received: true, duplicate: true, product: "titan_autopilot" };
  }
  throw new Error("Autopilot payment changed before settlement could be committed");
}

async function cancelAutopilotCheckout(admin, session, status = "canceled") {
  const { payment } = await readValidatedAutopilotPayment(admin, session);
  if (payment.status === "succeeded") {
    return { received: true, ignored: true, product: "titan_autopilot" };
  }

  let cancelMutation = admin
    .from("payments")
    .update({ status, updated_at: new Date().toISOString() })
    .neq("status", "succeeded");
  cancelMutation = guardAutopilotPaymentMutation(cancelMutation, payment);

  const { data: canceled, error: updateError } = await cancelMutation
    .select("id,status")
    .maybeSingle();
  if (updateError) throw updateError;
  if (!canceled) {
    const { data: current, error: currentError } = await admin
      .from("payments")
      .select("status")
      .eq("id", payment.id)
      .maybeSingle();
    if (currentError) throw currentError;
    if (current?.status === "succeeded") {
      return { received: true, ignored: true, product: "titan_autopilot" };
    }
    throw new Error("Autopilot payment changed before cancellation could be committed");
  }
  return { received: true, status: canceled.status, product: "titan_autopilot" };
}

async function processAutopilotEvent(admin, event, object) {
  if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
    return settleAutopilotCheckout(admin, object);
  }
  if (event.type === "checkout.session.expired") {
    return cancelAutopilotCheckout(admin, object, "canceled");
  }
  if (event.type === "checkout.session.async_payment_failed") {
    return cancelAutopilotCheckout(admin, object, "failed");
  }
  return { received: true, ignored: true, product: "titan_autopilot" };
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
    console.error("stripe:signature", error);
    return res.status(400).json({ error: "Invalid Stripe signature" });
  }

  const admin = getSupabaseAdmin();
  const object = event.data?.object || {};
  const metadata = object.metadata || {};
  const campaignId = metadata.campaign_id || object.client_reference_id || null;
  const isAutopilot = metadata.task_type === AUTOPILOT_TASK;

  if (isAutopilot) {
    let claim;
    try {
      claim = await claimAutopilotEvent(admin, event, object);
      if (claim.duplicate) {
        return res.status(200).json({ received: true, duplicate: true, product: "titan_autopilot" });
      }
      if (claim.busy) {
        res.setHeader("Retry-After", "5");
        return res.status(409).json({ error: "Autopilot Stripe event is already processing" });
      }

      const result = await processAutopilotEvent(admin, event, object);
      await completeAutopilotEvent(admin, event.id, claim.claimedAt);
      return res.status(200).json({ ...result, type: event.type, recovered_event: claim.recovered === true });
    } catch (error) {
      console.error("stripe:autopilot_webhook", error);
      if (claim?.acquired && claim.claimedAt) {
        await failAutopilotEvent(admin, event.id, claim.claimedAt, error);
      }
      return res.status(500).json({ error: "Webhook processing failed" });
    }
  }

  // Preserve the existing Attention campaign funding path. Its legacy event
  // ledger is intentionally isolated from the Autopilot claim-state migration.
  let claimedAttention = false;
  try {
    const { error: claimError } = await admin.from("attention_payment_events").insert({
      event_id: event.id,
      event_type: event.type,
      object_id: object.id || null,
      campaign_id: campaignId || null,
    });
    if (claimError) {
      if (isDuplicateError(claimError)) {
        return res.status(200).json({ received: true, duplicate: true });
      }
      throw claimError;
    }
    claimedAttention = true;

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
    console.error("stripe:webhook", error);
    if (claimedAttention && event?.id) {
      try {
        const { error: releaseError } = await admin
          .from("attention_payment_events")
          .delete()
          .eq("event_id", event.id);
        if (releaseError) console.error("stripe:attention_claim_release", releaseError);
      } catch (releaseError) {
        console.error("stripe:attention_claim_release", releaseError);
      }
    }
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}
