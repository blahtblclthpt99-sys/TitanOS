import { Capacitor } from "@capacitor/core";
import { supabase } from "@/api/supabaseClient";
import { standardSupabaseProjectRef } from "@/lib/supabaseUrl";

function apiError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function apiBase() {
  // Resend deliberately uses exactly one API host so an ambiguous first request
  // cannot automatically generate a second OTP elsewhere. On web previews, that
  // one host must be the current deployment; native uses configured production.
  if (typeof window !== "undefined" && !Capacitor.isNativePlatform()) {
    const { hostname, origin } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".vercel.app")) {
      return origin;
    }
  }

  const configured = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (configured) return configured;
  return "https://titanos-web.vercel.app";
}

export async function resendSignupOtp({ email, userId }) {
  if (!email || !userId) throw apiError("Restart signup to request a new code", 400);
  const clientProjectRef = standardSupabaseProjectRef(import.meta.env.VITE_SUPABASE_URL);

  try {
    const response = await fetch(`${apiBase()}/api/resendSignupOtp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, user_id: userId, clientProjectRef }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw apiError(body.error || "Verification code could not be resent", response.status);
    if (clientProjectRef && body.projectRef !== clientProjectRef) {
      throw apiError("Verification environment changed. Reload TitanOS and try again.", 409);
    }
    if (!["accepted", "uncertain"].includes(body.deliveryStatus) || body.verificationType !== "magiclink") {
      throw apiError("Verification service returned an unexpected response", 502);
    }
    return {
      sent: body.deliveryStatus === "accepted",
      deliveryStatus: body.deliveryStatus,
      verificationType: "magiclink",
    };
  } catch (error) {
    if (error?.status) throw error;
    throw apiError("Could not verify whether the new code was sent. Please check your email before retrying.", 503);
  }
}

export async function verifySignupOtp({ email, otpCode, verificationType = "signup" }) {
  const type = verificationType === "magiclink" ? "magiclink" : "signup";
  const token = String(otpCode || "").trim();
  if (!/^\d{6}$/.test(token)) throw apiError("Enter the six-digit verification code", 400);

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type,
  });
  if (error) throw apiError(error.message || "Invalid verification code", 400);
  if (!data?.session) throw apiError("Verification succeeded without a session", 500);
  return { session: data.session, user: data.user || data.session.user || null };
}
