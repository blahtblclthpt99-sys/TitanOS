import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { queue_id: queueId, to, subject, body, user_id: userId } = readJson(req);
    if (!body) return res.status(400).json({ error: "body is required" });

    const admin = getSupabaseAdmin();
    let row = null;
    if (queueId) {
      const { data } = await admin.from("follow_up_queue").select("*").eq("id", queueId).maybeSingle();
      row = data;
    }

    const emailTo = to || row?.customer_email;
    const message = body || row?.message || "";
    const emailSubject = subject || `Follow-up from TitanOS`;

    let emailed = false;
    let stub = false;
    if (emailTo) {
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
            to: [emailTo],
            subject: emailSubject,
            text: message,
          }),
        });
        if (!response.ok) {
          const err = await response.text();
          console.error("sendFollowUp Resend error:", err);
          return res.status(502).json({ error: "Failed to send email" });
        }
        emailed = true;
      } else {
        console.log("[sendFollowUp stub]", { to: emailTo, subject: emailSubject, body: message.slice(0, 120) });
        stub = true;
        emailed = true;
      }
    }

    if (queueId) {
      await admin
        .from("follow_up_queue")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          channel: emailed ? "email" : row?.channel || "in_app",
        })
        .eq("id", queueId);
    }

    return res.status(200).json({
      success: true,
      emailed,
      stub,
      user_id: userId || row?.user_id || null,
      message: emailed
        ? stub
          ? "Marked sent (email stub — add RESEND_API_KEY for live mail)"
          : "Follow-up emailed"
        : "Marked sent (no customer email on file)",
    });
  } catch (error) {
    console.error("sendFollowUp error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
}