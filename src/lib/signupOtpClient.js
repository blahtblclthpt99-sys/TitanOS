import { supabase } from "@/api/supabaseClient";

function apiError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function apiBases() {
  const bases = [];
  const configured = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (configured) bases.push(configured);
  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".vercel.app")) {
      bases.push(origin);
    }
    bases.push("https://titanos-web.vercel.app");
  }
  return [...new Set(bases)];
}

export async function resendSignupOtp({ email, userId }) {
  if (!email || !userId) throw apiError("Restart signup to request a new code", 400);
  let lastError = null;

  for (const base of apiBases()) {
    try {
      const response = await fetch(`${base}/api/resendSignupOtp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, user_id: userId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw apiError(body.error || "Verification code could not be resent", response.status);
      return {
        sent: body.sent === true,
        verificationType: body.verificationType === "magiclink" ? "magiclink" : "magiclink",
      };
    } catch (error) {
      lastError = error;
      if (error?.status && ![404, 502, 503].includes(error.status)) throw error;
    }
  }

  throw lastError || apiError("Verification service is unavailable", 503);
}

export async function verifySignupOtp({ email, otpCode, verificationType = "signup" }) {
  const type = verificationType === "magiclink" ? "magiclink" : "signup";
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: String(otpCode || "").trim(),
    type,
  });
  if (error) throw apiError(error.message || "Invalid verification code", 400);
  if (!data?.session) throw apiError("Verification succeeded without a session", 500);
  return { session: data.session, user: data.user || data.session.user || null };
}
