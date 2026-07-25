import { getSupabaseAdmin, readJson } from "./_lib/supabase.js";
import { recordSignupEmail, formatSignupEmailFile, getLocalSignupEmailsPath } from "./_lib/recordSignupEmail.js";
import { applyCors, handleOptions } from "./_lib/cors.js";
import { assertRateLimit } from "./_lib/rateLimit.js";
import { logError } from "./_lib/safeLog.js";
import fs from "node:fs";

/**
 * POST — log a signup email (used by client fallback path)
 * GET  — download signup emails (requires SIGNUP_EMAILS_EXPORT_KEY only — never service role)
 */
export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;

  try {
    const admin = getSupabaseAdmin();

    if (req.method === "POST") {
      if (!assertRateLimit(req, res, { limit: 15, windowMs: 60_000, key: "signupEmailsPost" })) return;
      const body = readJson(req);
      const result = await recordSignupEmail(admin, {
        email: body.email,
        fullName: body.fullName || body.full_name,
        source: body.source || "client",
      });
      return res.status(200).json(result);
    }

    if (req.method === "GET") {
      const secret = process.env.SIGNUP_EMAILS_EXPORT_KEY;
      if (!secret) {
        return res.status(503).json({ error: "Export not configured" });
      }
      const auth = String(req.headers.authorization || "");
      const key = String(req.query?.key || "");
      const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      // Never accept SUPABASE_SERVICE_ROLE_KEY as the export credential
      if (bearer !== secret && key !== secret) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      let text = "";
      const { data, error } = await admin
        .from("signup_emails")
        .select("email, full_name, source, created_at")
        .order("created_at", { ascending: true });

      if (!error && Array.isArray(data) && data.length) {
        text = formatSignupEmailFile(data);
      } else {
        try {
          text = fs.readFileSync(getLocalSignupEmailsPath(), "utf8");
        } catch {
          text = "# TitanOS signup emails\n";
        }
      }

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="signup-emails.txt"');
      return res.status(200).send(text);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    logError("api/signup-emails", err);
    return res.status(500).json({ error: "Failed" });
  }
}
