import { applyCors, handleOptions } from "./_lib/cors.js";
import { assertRateLimitAsync } from "./_lib/rateLimit.js";
import { getSupabaseAdmin, readJson } from "./_lib/supabase.js";
import { sendSignupVerificationOtp } from "./_lib/signupConfirmation.js";
import { logError } from "./_lib/safeLog.js";

function uuid(value) {
  const normalized = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
    ? normalized
    : "";
}

function normalizedEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!(await assertRateLimitAsync(req, res, {
    limit: 5,
    windowMs: 10 * 60 * 1000,
    key: "resendSignupOtp",
    requireDurable: true,
  }))) return;

  const body = readJson(req);
  const userId = uuid(body.user_id || body.userId);
  const email = normalizedEmail(body.email);
  if (!userId || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Verification code could not be resent" });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(userId);
    const user = userResult?.user || null;
    if (
      userError ||
      !user ||
      normalizedEmail(user.email) !== email ||
      user.email_confirmed_at ||
      user.confirmed_at
    ) {
      return res.status(400).json({ error: "Verification code could not be resent" });
    }

    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (error) throw error;

    const generatedUser = data?.user || null;
    const otp = String(data?.properties?.email_otp || "").trim();
    const hashed = String(data?.properties?.hashed_token || "").replace(/[^a-zA-Z0-9_-]/g, "");
    if (String(generatedUser?.id || "") !== userId || !/^\d{6}$/.test(otp) || !hashed) {
      const contractError = new Error("Supabase did not return a valid resend verification code");
      contractError.code = "SIGNUP_RESEND_CONTRACT_INVALID";
      throw contractError;
    }

    const delivery = await sendSignupVerificationOtp({
      email,
      otp,
      deliveryKey: `titan_signup_resend_${userId}_${hashed.slice(0, 32)}`,
    });
    if (!delivery.accepted) throw delivery.error;

    return res.status(202).json({ sent: true, verificationType: "magiclink" });
  } catch (error) {
    logError("api/resendSignupOtp", { code: error?.code, message: error?.message || String(error) });
    return res.status(424).json({
      error: "Verification code could not be resent. Please try again shortly.",
      code: String(error?.code || "SIGNUP_RESEND_UNAVAILABLE"),
    });
  }
}
