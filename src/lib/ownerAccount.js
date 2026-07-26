/**
 * Founder / platform-owner account helpers.
 * Only these identities get admin-tier authority UI + ∞ profile stats.
 * Year-of-realistic data is seeded separately for this email only.
 */
export const OWNER_EMAILS = Object.freeze([
  "mlafferty1991@yahoo.com",
  "blahtblclthpt99@gmail.com",
].map((e) => e.toLowerCase()));

/** Optional extra emails from env (comma-separated). */
function envOwnerEmails() {
  const raw =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_OWNER_EMAILS) ||
    "";
  return String(raw)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwnerAccount(user) {
  if (!user) return false;
  if (user.is_founder === true || user.role === "owner") return true;
  const email = String(user.email || "").toLowerCase().trim();
  if (!email) return false;
  return OWNER_EMAILS.includes(email) || envOwnerEmails().includes(email);
}

/** Display value for founder profile / limit stats. */
export function ownerStatDisplay(user, fallback) {
  if (isOwnerAccount(user)) return "∞";
  return fallback;
}
