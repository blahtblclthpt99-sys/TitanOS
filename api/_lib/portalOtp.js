import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Hash portal OTP before storage. Never log raw codes.
 * Pepper prefers dedicated secret, then service role (server-only).
 */
export function hashPortalOtp(email, code) {
  const pepper =
    process.env.PORTAL_OTP_PEPPER ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "titanos-portal-otp-dev-only";
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedCode = String(code || "").trim();
  return createHash("sha256")
    .update(`${pepper}:${normalizedEmail}:${normalizedCode}`)
    .digest("hex");
}

/** Timing-safe compare; accepts legacy plaintext 6-digit OTPs during transition. */
export function portalOtpMatches(stored, email, code) {
  if (!stored || !code) return false;
  const submitted = String(code).trim();
  const hashed = hashPortalOtp(email, submitted);
  const storedStr = String(stored);

  if (storedStr.length === hashed.length) {
    try {
      return timingSafeEqual(Buffer.from(storedStr, "utf8"), Buffer.from(hashed, "utf8"));
    } catch {
      return false;
    }
  }

  // Legacy plaintext OTPs only when explicitly enabled (transition window)
  if (String(process.env.PORTAL_OTP_ALLOW_LEGACY || "0") === "1") {
    if (/^\d{6}$/.test(storedStr) && storedStr === submitted) {
      return true;
    }
  }
  return false;
}
