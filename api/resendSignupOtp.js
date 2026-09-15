import { applyCors, handleOptions } from "./_lib/cors.js";
import { assertRateLimitAsync } from "./_lib/rateLimit.js";
import { getSupabaseAdmin, readJson } from "./_lib/supabase.js";
import { sendExistingSignupOtp } from "./_lib/signupConfirmation.js";
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

    const generated = await sendExistingSignupOtp(admin, {
      email,
      expectedUserId: userId,
    });

    return res.status(202).json({ sent: true, verificationType: generated.verificationType });
  } catch (error) {
    logError("api/resendSignupOtp", { code: error?.code, message: error?.message || String(error) });
    return res.status(424).json({
      error: "Verification code could not be resent. Please try again shortly.",
      code: String(error?.code || "SIGNUP_RESEND_UNAVAILABLE"),
    });
  }
}
