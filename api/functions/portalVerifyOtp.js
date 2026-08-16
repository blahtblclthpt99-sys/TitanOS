import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
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
  if (!(await assertRateLimitAsync(req, res, {
    limit: 20,
    windowMs: 60_000,
    key: "portalVerifyOtp",
    requireDurable: true,
  }))) return;

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
      !(await assertRateLimitAsync(req, res, {
        limit: 8,
        windowMs: 10 * 60_000,
        key: `portalVerify:${normalizedEmail}`,
        requireDurable: true,
      }))
    ) {
      return;
    }

    const { data: sessions, error: sessionError } = await admin
      .from("portal_sessions")
      .select("id,email,customer_id,created_by_id,otp_code,otp_expires_at,verified")
      .eq("email", normalizedEmail)
      .limit(5);
    if (sessionError) throw sessionError;

    const session = (sessions || []).find(
      (item) => !item.verified && item.created_by_id && portalOtpMatches(item.otp_code, normalizedEmail, submittedCode)
    );

    if (!session) {
      return res.status(401).json({ error: "Invalid verification code" });
    }
    if (!session.otp_expires_at || new Date(session.otp_expires_at) < new Date()) {
      return res.status(401).json({ error: "Verification code expired. Please request a new one." });
    }

    const { data: customer, error: customerError } = await admin
      .from("customers")
      .select("id,first_name,last_name,email,created_by_id")
      .eq("id", session.customer_id)
      .eq("created_by_id", session.created_by_id)
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer || String(customer.email || "").trim().toLowerCase() !== normalizedEmail) {
      return res.status(401).json({ error: "Invalid verification code" });
    }

    const rawToken = crypto.randomUUID() + crypto.randomUUID();
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await admin
      .from("portal_sessions")
      .update({
        verified: true,
        token: hashPortalToken(rawToken),
        token_expires_at: tokenExpiresAt,
        otp_code: null,
      })
      .eq("id", session.id)
      .eq("created_by_id", session.created_by_id)
      .eq("verified", false);
    if (updateError) throw updateError;

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
