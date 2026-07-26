import { resolvePortalSession } from "./portalToken.js";

/** Shared portal bearer auth for customer portal APIs. */
export async function requirePortalSession(admin, token) {
  if (!token || typeof token !== "string") {
    return { error: "Missing session token", status: 400 };
  }
  const session = await resolvePortalSession(admin, token);
  if (!session?.verified) return { error: "Invalid or expired session", status: 401 };
  if (!session.token_expires_at || new Date(session.token_expires_at) < new Date()) {
    return { error: "Session expired. Please sign in again.", status: 401 };
  }
  return { session };
}
