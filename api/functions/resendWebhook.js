import { getSupabaseAdmin } from "../_lib/supabase.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { verifyResendWebhook } from "../_lib/leadOutreach.js";
import { logError } from "../_lib/safeLog.js";

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString("utf8");
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!assertRateLimit(req, res, { key: "resend-webhook", limit: 600, windowMs: 60_000 })) return;
  const raw = await readRawBody(req);
  const verified = verifyResendWebhook({
    id: req.headers["svix-id"],
    timestamp: req.headers["svix-timestamp"],
    signature: req.headers["svix-signature"],
    payload: raw,
  }, process.env.RESEND_WEBHOOK_SECRET);
  if (!verified) return res.status(400).json({ error: "Invalid signature" });

  try {
    const event = JSON.parse(raw);
    const admin = getSupabaseAdmin();
    if (["email.bounced", "email.complained", "email.suppressed"].includes(event.type)) {
      const providerId = event.data?.email_id || event.data?.emailId;
      const recipient = Array.isArray(event.data?.to) ? event.data.to[0] : event.data?.to;
      if (!providerId && !recipient) throw new Error("Suppression event has no recipient identifier");
      let query = admin.from("leads").update({
        outreach_status: "suppressed",
        email_quality_status: "quarantined",
        suppression_reason: event.type,
        suppressed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      query = providerId ? query.eq("outreach_provider_id", providerId) : query.ilike("email", String(recipient || ""));
      const { error } = await query;
      if (error) throw error;
    }
    const { error: eventError } = await admin.from("lead_outreach_webhook_events").insert({ event_id: req.headers["svix-id"], event_type: event.type || "unknown" });
    if (eventError?.code === "23505") return res.status(200).json({ received: true, duplicate: true });
    if (eventError) throw eventError;
    return res.status(200).json({ received: true });
  } catch (error) {
    logError("resendWebhook", error);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}
