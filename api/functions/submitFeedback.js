import { readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";

const ALLOWED_CATEGORIES = new Set(["bug", "feature", "general"]);

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!assertRateLimit(req, res, { limit: 5, windowMs: 60_000, key: "submitFeedback" })) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const input = readJson(req);
    const message = String(input.message || "").trim();
    const category = ALLOWED_CATEGORIES.has(input.category) ? input.category : "general";
    if (message.length < 3 || message.length > 5000) {
      return res.status(400).json({ error: "Feedback must be between 3 and 5,000 characters." });
    }

    const row = {
      created_by_id: auth.user.id,
      type: category,
      category,
      message,
      email: auth.user.email || null,
      page: String(input.page || "").slice(0, 500) || null,
      status: "unread",
      app_version: String(input.app_version || "").slice(0, 40),
      device: String(input.device || "").slice(0, 500),
      screenshot_url: String(input.screenshot_url || "").slice(0, 2000),
    };

    const { data, error } = await auth.admin
      .from("beta_feedbacks")
      .insert(row)
      .select("id, created_at")
      .single();
    if (error) throw error;

    let emailed = false;
    const resendKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.FEEDBACK_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "hello@titanos.app";
    if (resendKey) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "TitanOS <noreply@titanos.app>",
          to: [adminEmail],
          subject: `[${category.toUpperCase()}] TitanOS feedback`,
          text: [
            `Feedback ID: ${data.id}`,
            `User: ${auth.user.id}`,
            `Email: ${auth.user.email || "Unknown"}`,
            `Version: ${row.app_version || "Unknown"}`,
            `Device: ${row.device || "Unknown"}`,
            `Page: ${row.page || "Unknown"}`,
            `Timestamp: ${data.created_at}`,
            `Screenshot: ${row.screenshot_url || "None"}`,
            "",
            message,
          ].join("\n"),
        }),
      });
      emailed = response.ok;
      if (!emailed) logError("submitFeedback:email", await response.text());
    }

    return res.status(201).json({ success: true, id: data.id, emailed });
  } catch (error) {
    logError("submitFeedback", error);
    captureApiException(error, { tags: { route: "submitFeedback" } });
    return res.status(500).json({ error: "Feedback could not be submitted." });
  }
}
