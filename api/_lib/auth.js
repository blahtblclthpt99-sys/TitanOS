import { getSupabaseAdmin } from "./supabase.js";

/**
 * Require a valid Supabase JWT from Authorization: Bearer …
 * Returns { user } or writes an error response and returns null.
 */
export async function requireUser(req, res) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json({ error: "Sign in required" });
    return null;
  }
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) {
      res.status(401).json({ error: "Session expired. Please sign in again." });
      return null;
    }
    return { user: data.user, admin, token };
  } catch (error) {
    console.error("requireUser error:", error);
    res.status(401).json({ error: "Authentication failed" });
    return null;
  }
}
