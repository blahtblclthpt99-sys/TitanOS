import { getSupabaseAdmin, readJson } from "./_lib/supabase.js";
import { recordSignupEmail, formatSignupEmailFile, getLocalSignupEmailsPath } from "./_lib/recordSignupEmail.js";
import fs from "node:fs";

/**
 * POST — log a signup email (used by client fallback path)
 * GET  — download all signup emails as a .txt file (admin service role)
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const admin = getSupabaseAdmin();

    if (req.method === "POST") {
      const body = readJson(req);
      const result = await recordSignupEmail(admin, {
        email: body.email,
        fullName: body.fullName || body.full_name,
        source: body.source || "client",
      });
      return res.status(200).json(result);
    }

    if (req.method === "GET") {
      const secret = process.env.SIGNUP_EMAILS_EXPORT_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
      const auth = String(req.headers.authorization || "");
      const key = String(req.query?.key || "");
      const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (!secret || (bearer !== secret && key !== secret)) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Prefer durable DB; fall back to local file
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
    console.error("[api/signup-emails]", err);
    return res.status(500).json({ error: err.message || "Failed" });
  }
}
