import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { hashPortalOtp } from "../_lib/portalOtp.js";
import { logError } from "../_lib/safeLog.js";

function randomOtp() {
  try {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 900000;
    return String(100000 + n);
  } catch {
    return String(100000 + Math.floor(Math.random() * 900000));
  }
}

async function sendOtpEmail(email, otpCode) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return { ok: false, reason: "email_not_configured" };
  }
  const body = `Your verification code is: ${otpCode}\n\nThis code expires in 10 minutes. If you did not request this, you can safely ignore this email.`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "TitanOS <noreply@titanos.app>",
      to: [email],
      subject: "Your TitanOS Portal Verification Code",
      text: body,
    }),
  });
  if (!response.ok) {
    return { ok: false, reason: "email_send_failed" };
  }
  return { ok: true };
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!assertRateLimit(req, res, { limit: 8, windowMs: 60_000, key: "portalRequestOtp" })) return;

  try {
    const admin = getSupabaseAdmin();
    const { email } = readJson(req);

    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: "Email is required" });
    }

    const trimmedEmail = email.trim();
    const emailKey = trimmedEmail.toLowerCase();
    if (
      !assertRateLimit(req, res, {
        limit: 3,
        windowMs: 10 * 60_000,
        key: `portalOtp:${emailKey}`,
      })
    ) {
      return;
    }

    // Fail closed when mail is unavailable — never log OTP codes.
    if (!process.env.RESEND_API_KEY) {
      return res.status(503).json({
        error: "Portal email is temporarily unavailable. Please try again later.",
      });
    }

    let customer = null;
    for (const variant of [trimmedEmail, trimmedEmail.toLowerCase(), trimmedEmail.toUpperCase()]) {
      const { data } = await admin.from("customers").select("*").eq("email", variant).limit(1);
      if (data?.length) {
        customer = data[0];
        break;
      }
    }

    if (customer) {
      const normalizedEmail = trimmedEmail.toLowerCase();
      const otp = randomOtp();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const otpHash = hashPortalOtp(normalizedEmail, otp);

      await admin.from("portal_sessions").delete().eq("email", normalizedEmail);
      await admin.from("portal_sessions").insert({
        email: normalizedEmail,
        customer_id: customer.id,
        otp_code: otpHash,
        otp_expires_at: otpExpiresAt,
        verified: false,
      });

      const sent = await sendOtpEmail(customer.email, otp);
      if (!sent.ok) {
        await admin.from("portal_sessions").delete().eq("email", normalizedEmail);
        return res.status(503).json({
          error: "Could not send verification email. Please try again later.",
        });
      }
    }

    // Always succeed for unknown emails (no account enumeration)
    return res.status(200).json({ success: true });
  } catch (error) {
    logError("portalRequestOtp", error);
    captureApiException(error, { tags: { route: "portalRequestOtp" } });
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
