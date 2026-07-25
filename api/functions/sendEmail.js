import { readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!assertRateLimit(req, res, { limit: 10, windowMs: 60_000, key: "sendEmail" })) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const { to, subject, body, from_name: fromName } = readJson(req);
    if (!to || !subject || !body) {
      return res.status(400).json({ error: "to, subject, and body are required" });
    }

    const recipients = (Array.isArray(to) ? to : [to])
      .map((r) => String(r || "").trim().toLowerCase())
      .filter(Boolean);

    if (recipients.length === 0 || recipients.length > 5) {
      return res.status(400).json({ error: "Invalid recipients" });
    }
    if (recipients.some((r) => !EMAIL_RE.test(r))) {
      return res.status(400).json({ error: "Invalid email address" });
    }
    if (String(body).length > 20000 || String(subject).length > 200) {
      return res.status(400).json({ error: "Message too large" });
    }

    // Restrict destinations to the caller's own email or customers they own.
    const { admin, user } = auth;
    const { data: profile } = await admin
      .from("profiles")
      .select("email, role")
      .eq("id", user.id)
      .maybeSingle();
    const ownEmail = String(profile?.email || user.email || "").toLowerCase();
    const isAdmin = profile?.role === "admin" || user.app_metadata?.role === "admin";

    if (!isAdmin) {
      const { data: customers } = await admin
        .from("customers")
        .select("email")
        .eq("created_by_id", user.id)
        .limit(500);
      const allowed = new Set(
        [ownEmail, ...(customers || []).map((c) => String(c.email || "").toLowerCase())].filter(Boolean)
      );
      const blocked = recipients.filter((r) => !allowed.has(r));
      if (blocked.length) {
        return res.status(403).json({
          error: "You can only email yourself or customers you own.",
        });
      }
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "TitanOS <noreply@titanos.app>",
          to: recipients,
          subject,
          text: body,
          tags: [{ name: "user_id", value: auth.user.id.slice(0, 36) }],
        }),
      });
      if (!response.ok) {
        const err = await response.text();
        logError("sendEmail:resend", err);
        return res.status(502).json({ error: "Failed to send email" });
      }
      return res.status(200).json({ success: true });
    }

    logError("sendEmail:stub", {
      message: "Email delivery not configured",
      user: auth.user.id,
      recipientCount: recipients.length,
      subjectLength: String(subject).length,
    });
    return res.status(503).json({
      error: "Email delivery is not configured",
      stub: true,
    });
  } catch (error) {
    logError("sendEmail", error);
    captureApiException(error, { tags: { route: "sendEmail" } });
    return res.status(500).json({ error: "Something went wrong" });
  }
}
