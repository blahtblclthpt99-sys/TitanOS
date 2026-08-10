import { getSupabaseAdmin } from "../_lib/supabase.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { verifyUnsubscribeToken } from "../_lib/leadOutreach.js";

const SUCCESS_HTML = "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>Unsubscribed</title></head><body style=\"font-family:system-ui;padding:40px;max-width:640px;margin:auto\"><h1>You are unsubscribed</h1><p>TitanOS will not send further outreach to this address.</p></body></html>";

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { key: "lead-unsubscribe", limit: 30, windowMs: 60_000 }))) return;
  const token = String(req.query?.token || req.body?.token || "");
  const value = verifyUnsubscribeToken(token, process.env.OUTREACH_UNSUBSCRIBE_SECRET);
  if (!value) return res.status(400).json({ error: "This unsubscribe link is invalid." });

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin().from("leads").update({
    outreach_status: "suppressed",
    suppression_reason: "unsubscribe",
    suppressed_at: now,
    updated_at: now,
  }).eq("id", value.leadId).eq("created_by_id", value.ownerId).ilike("email", value.email);
  if (error) return res.status(500).json({ error: "We couldn't save your request. Please reply unsubscribe instead." });
  if (req.method === "POST") return res.status(200).json({ unsubscribed: true });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(SUCCESS_HTML);
}
