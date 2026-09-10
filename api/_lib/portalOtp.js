import { createHash, timingSafeEqual } from "node:crypto";

function portalPepper() {
  const pepper = String(process.env.PORTAL_OTP_PEPPER || "").trim();
  if (pepper) return pepper;
  if (process.env.NODE_ENV === "production") {
    throw new Error("PORTAL_OTP_PEPPER is required in production");
  }
  return "titanos-portal-otp-dev-only";
}

/** Hash portal OTP before storage. Never log raw codes. */
export function hashPortalOtp(email, code) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedCode = String(code || "").trim();
  return createHash("sha256")
    .update(`${portalPepper()}:${normalizedEmail}:${normalizedCode}`)
    .digest("hex");
}

/** Timing-safe compare; accepts legacy plaintext 6-digit OTPs only when explicitly enabled. */
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

  if (String(process.env.PORTAL_OTP_ALLOW_LEGACY || "0") === "1") {
    if (/^\d{6}$/.test(storedStr) && storedStr === submitted) return true;
  }
  return false;
}
