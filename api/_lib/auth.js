import { getSupabaseAdmin } from "./supabase.js";
import { logError } from "./safeLog.js";

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
    logError("requireUser", error);
    res.status(401).json({ error: "Authentication failed" });
    return null;
  }
}

/**
 * Require authenticated admin (JWT app_metadata.role or profiles.role).
 */
export async function requireAdmin(req, res) {
  const auth = await requireUser(req, res);
  if (!auth) return null;
  const { user, admin } = auth;
  if (user.app_metadata?.role === "admin") return auth;
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role === "admin") return auth;
  res.status(403).json({ error: "Admin access required" });
  return null;
}
