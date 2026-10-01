import { createHash } from "node:crypto";

function pepper() {
  const value = String(process.env.PORTAL_OTP_PEPPER || "").trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("PORTAL_OTP_PEPPER is required in production");
  }
  return "titanos-portal-otp-dev-only";
}

const SESSION_FIELDS = "id,created_at,updated_at,created_by_id,email,customer_id,otp_expires_at,verified,token,token_expires_at";

/** Hash portal bearer tokens at rest. Never store the raw UUID token. */
export function hashPortalToken(token) {
  return createHash("sha256")
    .update(`${pepper()}:portal-session:${String(token || "")}`)
    .digest("hex");
}

/**
 * Resolve a portal session by bearer token.
 * Hashed lookup is authoritative. Legacy plaintext lookup is OFF unless an
 * operator explicitly opts in for a short migration window.
 */
export async function resolvePortalSession(admin, rawToken) {
  const token = String(rawToken || "").trim();
  if (!token || token.length < 32 || token.length > 256) return null;

  const hashed = hashPortalToken(token);
  const { data: byHash, error: hashErr } = await admin
    .from("portal_sessions")
    .select(SESSION_FIELDS)
    .eq("token", hashed)
    .limit(1);
  if (hashErr) throw hashErr;
  if (byHash?.[0]) return byHash[0];

  const allowLegacy = String(process.env.PORTAL_TOKEN_ALLOW_LEGACY || "0") === "1";
  if (!allowLegacy) return null;

  const { data: legacy, error: legErr } = await admin
    .from("portal_sessions")
    .select(SESSION_FIELDS)
    .eq("token", token)
    .limit(1);
  if (legErr) throw legErr;
  return legacy?.[0] || null;
}
