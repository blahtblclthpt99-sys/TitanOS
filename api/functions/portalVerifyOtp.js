import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const admin = getSupabaseAdmin();
    const { email, otp_code: otpCode } = readJson(req);

    if (!email || !otpCode) {
      return res.status(400).json({ error: "Email and code are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const submittedCode = String(otpCode).trim();

    const { data: sessions } = await admin
      .from("portal_sessions")
      .select("*")
      .eq("email", normalizedEmail);

    const session = (sessions || []).find(
      (item) => !item.verified && item.otp_code === submittedCode
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

    const token = crypto.randomUUID() + crypto.randomUUID();
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await admin
      .from("portal_sessions")
      .update({
        verified: true,
        token,
        token_expires_at: tokenExpiresAt,
        otp_code: null,
      })
      .eq("id", session.id);

    return res.status(200).json({
      token,
      customer: {
        id: customer.id,
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email,
      },
    });
  } catch (error) {
    console.error("portalVerifyOtp error:", error);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
