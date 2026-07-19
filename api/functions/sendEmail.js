import { readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const { to, subject, body, from_name: fromName } = readJson(req);
    if (!to || !subject || !body) {
      return res.status(400).json({ error: "to, subject, and body are required" });
    }

    // Basic abuse controls
    const recipients = Array.isArray(to) ? to : [to];
    if (recipients.length > 5) {
      return res.status(400).json({ error: "Too many recipients" });
    }
    if (String(body).length > 20000 || String(subject).length > 200) {
      return res.status(400).json({ error: "Message too large" });
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
        console.error("Resend error:", err);
        return res.status(502).json({ error: "Failed to send email" });
      }
      return res.status(200).json({ success: true });
    }

    console.log("[sendEmail stub]", {
      user: auth.user.id,
      to,
      subject,
      fromName,
      body: String(body).slice(0, 120),
    });
    return res.status(200).json({ success: true, stub: true });
  } catch (error) {
    console.error("sendEmail error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
