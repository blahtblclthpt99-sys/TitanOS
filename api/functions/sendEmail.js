import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { to, subject, body, from_name: fromName } = readJson(req);
    if (!to || !subject || !body) {
      return res.status(400).json({ error: "to, subject, and body are required" });
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
          to: [to],
          subject,
          text: body,
        }),
      });
      if (!response.ok) {
        const err = await response.text();
        console.error("Resend error:", err);
        return res.status(502).json({ error: "Failed to send email" });
      }
      return res.status(200).json({ success: true });
    }

    console.log("[sendEmail stub]", { to, subject, fromName, body: body.slice(0, 120) });
    return res.status(200).json({ success: true, stub: true });
  } catch (error) {
    console.error("sendEmail error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
