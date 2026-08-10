import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { logError } from "../_lib/safeLog.js";
import { FEATURES, requireFeature } from "../_lib/entitlements.js";
import {
  escapeEmailHtml,
  extractMailbox,
  personalizeOutreach,
  safeLeadText,
  validLeadEmail,
} from "../_lib/leadOutreach.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireUser(req, res);
  if (!auth) return;
  if (!(await requireFeature(res, auth.admin, auth.user, FEATURES.leadOutreach))) return;
  if (!(await assertRateLimitAsync(req, res, { key: "lead-worker-send", limit: 4, windowMs: 60_000 }))) return;

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.OUTREACH_FROM_EMAIL || process.env.RESEND_FROM;
  const replyTo = process.env.OUTREACH_REPLY_TO || from;
  const unsubscribeMailbox = extractMailbox(replyTo);
  if (!resendKey || !from) return res.status(503).json({ error: "Email delivery is not configured yet." });
  if (req.body?.confirmCompliant !== true) return res.status(400).json({ error: "Confirm compliant business outreach before sending." });

  const ids = [...new Set((Array.isArray(req.body?.leadIds) ? req.body.leadIds : []).map(String))].slice(0, 25);
  const subject = safeLeadText(req.body?.subject, 160);
  const message = safeLeadText(req.body?.message, 5000);
  if (!ids.length || !subject || !message) return res.status(400).json({ error: "Select leads and provide a subject and message." });

  const { data: leads = [], error } = await auth.admin
    .from("leads")
    .select("id,name,company,email,outreach_status")
    .eq("created_by_id", auth.user.id)
    .in("id", ids);
  if (error) return res.status(500).json({ error: "Couldn't load selected leads." });

  const results = [];
  for (const lead of leads) {
    if (!validLeadEmail(lead.email) || lead.outreach_status === "suppressed") {
      results.push({ id: lead.id, sent: false, error: "Invalid or suppressed email" });
      continue;
    }
    const personalizedSubject = personalizeOutreach(subject, lead);
    const personalizedMessage = personalizeOutreach(message, lead);
    const footer = "TitanOS business outreach. Reply with “unsubscribe” and we will not contact you again.";
    try {
      const provider = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          reply_to: replyTo,
          to: [lead.email],
          subject: personalizedSubject,
          text: `${personalizedMessage}\n\n---\n${footer}`,
          html: `${escapeEmailHtml(personalizedMessage).replaceAll("\n", "<br>")}<hr style="border:0;border-top:1px solid #ddd;margin:24px 0"><p style="color:#666;font-size:12px">${footer}</p>`,
          headers: { "List-Unsubscribe": `<mailto:${unsubscribeMailbox}?subject=unsubscribe>` },
        }),
      });
      const payload = await provider.json().catch(() => ({}));
      if (!provider.ok) throw new Error(payload?.message || `Delivery failed (${provider.status})`);
      await auth.admin.from("leads").update({
        status: "emailed",
        outreach_status: "sent",
        outreach_subject: personalizedSubject,
        outreach_message: personalizedMessage,
        outreach_provider_id: payload.id || "",
        outreach_error: "",
        emailed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", lead.id).eq("created_by_id", auth.user.id);
      results.push({ id: lead.id, sent: true, providerId: payload.id || "" });
    } catch (sendError) {
      logError("leadWorkerSend", sendError);
      await auth.admin.from("leads").update({ outreach_status: "failed", outreach_error: safeLeadText(sendError.message, 300), updated_at: new Date().toISOString() }).eq("id", lead.id).eq("created_by_id", auth.user.id);
      results.push({ id: lead.id, sent: false, error: "Delivery failed" });
    }
  }

  const sent = results.filter((result) => result.sent).length;
  return res.status(200).json({ sent, failed: results.length - sent, results });
}
