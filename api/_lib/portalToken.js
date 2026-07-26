import { createHash } from "node:crypto";

function pepper() {
  return (
    process.env.PORTAL_OTP_PEPPER ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "titanos-portal-otp-dev-only"
  );
}

/** Hash portal bearer tokens at rest. Never store the raw UUID token. */
export function hashPortalToken(token) {
  return createHash("sha256")
    .update(`${pepper()}:portal-session:${String(token || "")}`)
    .digest("hex");
}

/**
 * Resolve a portal session by bearer token.
 * Prefers hashed lookup; optionally accepts legacy plaintext rows until migrated.
 */
export async function resolvePortalSession(admin, rawToken) {
  const token = String(rawToken || "").trim();
  if (!token || token.length < 32) return null;

  const hashed = hashPortalToken(token);
  const { data: byHash, error: hashErr } = await admin
    .from("portal_sessions")
    .select("*")
    .eq("token", hashed)
    .limit(1);
  if (hashErr) throw hashErr;
  if (byHash?.[0]) return byHash[0];

  const allowLegacy = String(process.env.PORTAL_TOKEN_ALLOW_LEGACY || "1") !== "0";
  if (!allowLegacy) return null;

  const { data: legacy, error: legErr } = await admin
    .from("portal_sessions")
    .select("*")
    .eq("token", token)
    .limit(1);
  if (legErr) throw legErr;
  return legacy?.[0] || null;
}
