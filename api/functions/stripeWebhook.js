import legacyProductHandler from "../_lib/stripeWebhookProductHandler.js";

export const config = { api: { bodyParser: false } };

const ATTENTION_KIND = "attention_campaign_funding";

async function readRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.body === "string") return Buffer.from(req.body);
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return chunks.length ? Buffer.concat(chunks) : null;
}

function isAttentionDeployment() {
  const explicit = String(
    process.env.TITAN_STRIPE_WEBHOOK_PRODUCT ||
    process.env.TITAN_PRODUCT_SURFACE ||
    process.env.VITE_APP_SURFACE ||
    ""
  ).trim().toLowerCase();
  if (["attention", "titan_attention"].includes(explicit)) return true;
  if (["titanos", "autopilot", "titan_os"].includes(explicit)) return false;

  const hostHint = String(
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    ""
  ).toLowerCase();
  return (
    hostHint.includes("titan-os-six.vercel.app") ||
    hostHint.includes("titan-os-git-") ||
    /(^|\.)titan-o[a-z0-9-]*\.vercel\.app$/.test(hostHint)
  );
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Titan Autopilot is free. Its deployment has no Stripe execution or pricing
  // dependency; acknowledge stale webhook deliveries without opening Stripe or
  // Supabase. Titan Attention remains an isolated product surface below.
  if (!isAttentionDeployment()) {
    return res.status(200).json({
      received: true,
      ignored: true,
      product: "titanos",
      reason: "autopilot_payments_retired",
    });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) {
    return res.status(503).json({ error: "Stripe webhook is not configured" });
  }

  let event;
  let rawBody;
  try {
    const signature = req.headers["stripe-signature"];
    if (!signature) return res.status(400).json({ error: "Missing Stripe-Signature" });
    rawBody = await readRawBody(req);
    if (!rawBody?.length) return res.status(400).json({ error: "Raw body required" });

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("stripe:signature", error);
    return res.status(400).json({ error: "Invalid Stripe signature" });
  }

  const metadata = event?.data?.object?.metadata || {};
  if (metadata.kind !== ATTENTION_KIND) {
    return res.status(200).json({
      received: true,
      ignored: true,
      product: "unclassified",
      type: event.type,
    });
  }

  req.rawBody = rawBody;
  return legacyProductHandler(req, res);
}
