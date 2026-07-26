import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { portalOtpMatches } from "../_lib/portalOtp.js";
import { hashPortalToken } from "../_lib/portalToken.js";
import { logError } from "../_lib/safeLog.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!assertRateLimit(req, res, { limit: 20, windowMs: 60_000, key: "portalVerifyOtp" })) return;

  try {
    const admin = getSupabaseAdmin();
    const { email, otp_code: otpCode } = readJson(req);

    if (!email || !otpCode) {
      return res.status(400).json({ error: "Email and code are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const submittedCode = String(otpCode).trim();
    if (!/^\d{6}$/.test(submittedCode)) {
      return res.status(401).json({ error: "Invalid verification code" });
    }

    if (
      !assertRateLimit(req, res, {
        limit: 8,
        windowMs: 10 * 60_000,
        key: `portalVerify:${normalizedEmail}`,
      })
    ) {
      return;
    }

    const { data: sessions } = await admin
      .from("portal_sessions")
      .select("*")
      .eq("email", normalizedEmail);

    const session = (sessions || []).find(
      (item) => !item.verified && portalOtpMatches(item.otp_code, normalizedEmail, submittedCode)
    );

    if (!session) {
      return res.status(401).json({ error: "Invalid verification code" });
    }
    if (!session.otp_expires_at || new Date(session.otp_expires_at) < new Date()) {
      return res.status(401).json({ error: "Verification code expired. Please request a new one." });
    }

    const { data: customer, error: customerError } = await admin
      .from("customers")
      .select("*")
      .eq("id", session.customer_id)
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer) {
      return res.status(404).json({ error: "Account not found" });
    }

    const rawToken = crypto.randomUUID() + crypto.randomUUID();
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await admin
      .from("portal_sessions")
      .update({
        verified: true,
        token: hashPortalToken(rawToken),
        token_expires_at: tokenExpiresAt,
        otp_code: null,
      })
      .eq("id", session.id);

    return res.status(200).json({
      token: rawToken,
      customer: {
        id: customer.id,
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email,
      },
    });
  } catch (error) {
    logError("portalVerifyOtp", error);
    captureApiException(error, { tags: { route: "portalVerifyOtp" } });
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
