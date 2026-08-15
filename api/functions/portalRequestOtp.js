import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { hashPortalOtp } from "../_lib/portalOtp.js";
import { logError } from "../_lib/safeLog.js";
import { randomInt } from "node:crypto";

function randomOtp() {
  return String(randomInt(100000, 1000000));
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

    // Collect all customer records matching this email (any case variant) to detect cross-tenant ambiguity.
    const allMatches = [];
    for (const variant of [trimmedEmail, trimmedEmail.toLowerCase(), trimmedEmail.toUpperCase()]) {
      const { data } = await admin
        .from("customers")
        .select("id, email, first_name, last_name, created_by_id")
        .eq("email", variant);
      if (data?.length) {
        for (const row of data) {
          if (!allMatches.some((m) => m.id === row.id)) allMatches.push(row);
        }
      }
    }

    // Fail closed: if the email maps to customers in multiple tenants (distinct created_by_id),
    // do not create a session. This prevents cross-tenant portal access.
    // Customers with null created_by_id are legacy/unowned records; they are only served when
    // there is exactly one matching record so the identity is still unambiguous.
    const tenantIds = [...new Set(allMatches.map((m) => m.created_by_id).filter(Boolean))];
    let customer = null;
    if (tenantIds.length === 1) {
      // Exactly one tenant — unambiguous.
      customer = allMatches[0];
    } else if (tenantIds.length === 0 && allMatches.length === 1) {
      // Single legacy record with no tenant binding — still unambiguous.
      customer = allMatches[0];
    }
    // tenantIds.length > 1 or (tenantIds.length === 0 and allMatches.length > 1): fail closed.

    if (customer) {
      const normalizedEmail = trimmedEmail.toLowerCase();
      const otp = randomOtp();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const otpHash = hashPortalOtp(normalizedEmail, otp);

      await admin.from("portal_sessions").delete().eq("email", normalizedEmail);
      await admin.from("portal_sessions").insert({
        email: normalizedEmail,
        customer_id: customer.id,
        business_owner_id: customer.created_by_id || null,
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
