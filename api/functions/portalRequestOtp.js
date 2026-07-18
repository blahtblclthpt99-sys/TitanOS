import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";

async function sendOtpEmail(email, otpCode) {
  const resendKey = process.env.RESEND_API_KEY;
  const body = `Your verification code is: ${otpCode}\n\nThis code expires in 10 minutes. If you did not request this, you can safely ignore this email.`;
  if (resendKey) {
    await fetch("https://api.resend.com/emails", {
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
    return;
  }
  console.log("[portal OTP]", email, otpCode);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const admin = getSupabaseAdmin();
    const { email } = readJson(req);

    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: "Email is required" });
    }

    const trimmedEmail = email.trim();
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
      const otpCode = String(Math.floor(100000 + Math.random() * 900000));
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await admin.from("portal_sessions").delete().eq("email", normalizedEmail);

      await admin.from("portal_sessions").insert({
        email: normalizedEmail,
        customer_id: customer.id,
        otp_code: otpCode,
        otp_expires_at: otpExpiresAt,
        verified: false,
      });

      await sendOtpEmail(customer.email, otpCode);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("portalRequestOtp error:", error);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
