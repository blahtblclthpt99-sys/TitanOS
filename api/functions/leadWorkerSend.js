import { requireUser } from "../_lib/auth.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { logError } from "../_lib/safeLog.js";
import { FEATURES, requireFeature } from "../_lib/entitlements.js";
import {
  createUnsubscribeToken,
  escapeEmailHtml,
  extractMailbox,
  outreachIdempotencyKey,
  personalizeOutreach,
  safeLeadText,
  validLeadEmail,
} from "../_lib/leadOutreach.js";

const MAX_BATCH = 5;

function boundedDailyLimit() {
  return Math.min(100, Math.max(1, Number(process.env.OUTREACH_DAILY_LIMIT) || 5));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireUser(req, res);
  if (!auth) return;
  if (!(await requireFeature(res, auth.admin, auth.user, FEATURES.leadOutreach))) return;
  if (!(await assertRateLimitAsync(req, res, { key: "lead-worker-send", limit: 2, windowMs: 60_000 }))) return;

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.OUTREACH_FROM_EMAIL || process.env.RESEND_FROM;
  const replyTo = process.env.OUTREACH_REPLY_TO || from;
  const postalAddress = safeLeadText(process.env.OUTREACH_POSTAL_ADDRESS, 300);
  const unsubscribeSecret = process.env.OUTREACH_UNSUBSCRIBE_SECRET;
  const publicOrigin = String(process.env.TITANOS_PUBLIC_ORIGIN || process.env.VITE_TITANOS_PUBLIC_ORIGIN || "").replace(/\/$/, "");
  const unsubscribeMailbox = extractMailbox(replyTo);
  if (!resendKey || !from || !postalAddress || !unsubscribeSecret || !publicOrigin || !process.env.RESEND_WEBHOOK_SECRET) {
    return res.status(503).json({ error: "Compliant email delivery is not configured yet." });
  }
  if (req.body?.confirmCompliant !== true) return res.status(400).json({ error: "Confirm compliant business outreach before sending." });

  const subject = safeLeadText(req.body?.subject, 160);
  const message = safeLeadText(req.body?.message, 5000);
  const requestedIds = [...new Set((Array.isArray(req.body?.leadIds) ? req.body.leadIds : []).map(String))].slice(0, MAX_BATCH);
  if (!requestedIds.length || !subject || !message) return res.status(400).json({ error: "Select leads and provide a subject and message." });

  const { data: leads = [], error } = await auth.admin
    .from("leads")
    .select("id,name,company,email,outreach_status,email_quality_status,outreach_attempt_count")
    .eq("created_by_id", auth.user.id)
    .in("id", requestedIds);
  if (error) return res.status(500).json({ error: "Couldn't load selected leads." });

  const results = [];
  for (const lead of leads) {
    if (!validLeadEmail(lead.email) || lead.email_quality_status !== "verified" || ["sent", "sending", "suppressed"].includes(lead.outreach_status)) {
      results.push({ id: lead.id, sent: false, error: "Lead is not verified or is already handled" });
      continue;
    }
    const { data: claimed, error: claimError } = await auth.admin.rpc("claim_lead_outreach", {
      p_lead_id: lead.id,
      p_owner_id: auth.user.id,
      p_daily_limit: boundedDailyLimit(),
    });
    if (claimError) return res.status(500).json({ error: "Couldn't reserve the outreach send." });
    if (!claimed) {
      results.push({ id: lead.id, sent: false, error: "Daily limit reached or lead already handled" });
      continue;
    }

    const personalizedSubject = personalizeOutreach(subject, lead);
    const personalizedMessage = personalizeOutreach(message, lead);
    const token = createUnsubscribeToken({ leadId: lead.id, ownerId: auth.user.id, email: lead.email }, unsubscribeSecret);
    const unsubscribeUrl = `${publicOrigin}/api/functions/unsubscribeLead?token=${encodeURIComponent(token)}`;
    const footerText = `Advertisement from TitanOS. TitanOS, ${postalAddress}. Unsubscribe immediately: ${unsubscribeUrl} or reply "unsubscribe".`;
    try {
      const provider = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": outreachIdempotencyKey(lead.id, personalizedSubject),
        },
        body: JSON.stringify({
          from,
          reply_to: replyTo,
          to: [lead.email],
          subject: personalizedSubject,
          text: `${personalizedMessage}\n\n---\n${footerText}`,
          html: `${escapeEmailHtml(personalizedMessage).replaceAll("\n", "<br>")}<hr style="border:0;border-top:1px solid #ddd;margin:24px 0"><p style="color:#666;font-size:12px">Advertisement from TitanOS.<br>TitanOS, ${escapeEmailHtml(postalAddress)}.<br><a href="${escapeEmailHtml(unsubscribeUrl)}">Unsubscribe immediately</a> or reply &quot;unsubscribe&quot;.</p>`,
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:${unsubscribeMailbox}?subject=unsubscribe>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }),
      });
      const payload = await provider.json().catch(() => ({}));
      if (!provider.ok) throw new Error(payload?.message || `Delivery failed (${provider.status})`);
      const now = new Date().toISOString();
      await auth.admin.from("leads").update({
        status: "emailed",
        outreach_status: "sent",
        outreach_subject: personalizedSubject,
        outreach_message: personalizedMessage,
        outreach_provider_id: payload.id || "",
        outreach_error: "",
        outreach_attempt_count: Number(lead.outreach_attempt_count || 0) + 1,
        emailed_at: now,
        updated_at: now,
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
