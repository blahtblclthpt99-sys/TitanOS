/**
 * Founder / platform-owner account helpers.
 * Elevated authority only — never invent fake ∞ stats in the UI.
 */
export const OWNER_EMAILS = Object.freeze(
  ["mlafferty1991@yahoo.com", "blahtblclthpt99@gmail.com"].map((e) => e.toLowerCase())
);

/** Optional extra emails from env (comma-separated). */
function envOwnerEmails() {
  const raw =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_OWNER_EMAILS) || "";
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

/** Prefer real values — never invent ∞ for display. */
export function ownerStatDisplay(_user, fallback) {
  return fallback;
}
