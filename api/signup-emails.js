import { getSupabaseAdmin } from "./_lib/supabase.js";
import { formatSignupEmailFile } from "./_lib/recordSignupEmail.js";
import { applyCors, handleOptions } from "./_lib/cors.js";
import { logError } from "./_lib/safeLog.js";
import { secretsEqual } from "./_lib/secureCompare.js";

/**
 * GET — export signup emails from durable storage using a dedicated secret.
 *
 * Client-side POST logging is intentionally retired. Account registration
 * records signup audit data inside the authenticated server registration flow;
 * accepting arbitrary unauthenticated email writes created abuse/noise risk and
 * provided no authoritative account evidence.
 */
export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;

  try {
    if (req.method === "POST") {
      return res.status(410).json({
        error: "Client signup logging has been retired",
        code: "SIGNUP_LOGGING_RETIRED",
      });
    }

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const secret = String(process.env.SIGNUP_EMAILS_EXPORT_KEY || "").trim();
    if (!secret) {
      return res.status(503).json({ error: "Export not configured" });
    }

    const auth = String(req.headers.authorization || "");
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    // Header-only — never accept ?key= because URLs leak into referrers/logs.
    if (!secretsEqual(bearer, secret)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("signup_emails")
      .select("email, full_name, source, created_at, updated_at")
      .order("created_at", { ascending: true });

    if (error) {
      logError("api/signup-emails:export", { code: error.code || "DB_ERROR" });
      return res.status(503).json({
        error: "Signup email export is temporarily unavailable",
        code: "SIGNUP_EXPORT_UNAVAILABLE",
      });
    }

    const text = formatSignupEmailFile(Array.isArray(data) ? data : []);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="signup-emails.txt"');
    return res.status(200).send(text);
  } catch (err) {
    logError("api/signup-emails", { message: err?.message || String(err) });
    return res.status(500).json({ error: "Signup email export failed" });
  }
}
