import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin, getSupabaseAnonKey, readJson } from "./_lib/supabase.js";
import { recordSignupEmail } from "./_lib/recordSignupEmail.js";
import { applyCors, handleOptions } from "./_lib/cors.js";
import { assertRateLimitAsync } from "./_lib/rateLimit.js";
import { createSignupWithConfirmation } from "./_lib/signupConfirmation.js";
import { logError } from "./_lib/safeLog.js";
import { captureApiException } from "./_lib/sentry.js";

function registrationErrorResponse(res, error) {
  const message = String(error?.message || "");
  if (/already|registered|exists/i.test(message)) {
    return res.status(409).json({
      error: "An account with this email already exists",
      code: "EMAIL_TAKEN",
    });
  }
  if (/password|weak|least/i.test(message)) {
    return res.status(400).json({
      error: "Password does not meet requirements",
      code: "WEAK_PASSWORD",
    });
  }
  if (String(error?.code || "").startsWith("SIGNUP_MAIL_")) {
    logError("api/register:confirmation", { code: error.code, message });
    return res.status(503).json({
      error: "Verification email is temporarily unavailable. Please try again shortly.",
      code: error.code,
    });
  }
  logError("api/register:createUser", error);
  return res.status(400).json({
    error: "Could not create account. Check your email and password.",
    code: "REGISTER_FAILED",
  });
}

/**
 * Server-side registration.
 * Production (VERCEL_ENV=production) requires email confirmation unless
 * REGISTER_REQUIRE_EMAIL_CONFIRM is explicitly set to "false".
 * Registration uses Titan's durable rate-limit path in production so multiple
 * function instances cannot independently grant the full signup allowance.
 */
export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!(await assertRateLimitAsync(req, res, {
    limit: 8,
    windowMs: 60 * 60 * 1000,
    key: "register",
    requireDurable: true,
  }))) {
    return;
  }

  try {
    const body = readJson(req);
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const fullName = String(body.fullName || body.full_name || "").trim();
    const flag = process.env.REGISTER_REQUIRE_EMAIL_CONFIRM;
    const requireConfirm =
      flag != null && String(flag).trim() !== ""
        ? String(flag).toLowerCase() === "true"
        : String(process.env.VERCEL_ENV || "").toLowerCase() === "production";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid email is required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (fullName.length > 120) {
      return res.status(400).json({ error: "Name is too long" });
    }

    const admin = getSupabaseAdmin();
    let createdUser = null;
    let signInClient = null;

    if (requireConfirm) {
      try {
        const generated = await createSignupWithConfirmation(admin, {
          email,
          password,
          fullName,
        });
        createdUser = generated.user;
      } catch (createError) {
        return registrationErrorResponse(res, createError);
      }
    } else {
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const anon = getSupabaseAnonKey();
      if (!url || !anon) {
        return res.status(500).json({ error: "Server auth is misconfigured" });
      }
      signInClient = createClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: fullName ? { full_name: fullName } : undefined,
      });
      if (createError) return registrationErrorResponse(res, createError);
      createdUser = created.user;
    }

    await recordSignupEmail(admin, { email, fullName, source: "register" });

    // Founding 100 claim (also runs from profiles AFTER INSERT trigger — best-effort here)
    if (createdUser?.id) {
      try {
        await admin.rpc("claim_founding_slot", { p_user_id: createdUser.id });
      } catch {
        /* trigger may already have claimed; ignore */
      }
    }

    if (requireConfirm) {
      return res.status(200).json({
        user: {
          id: createdUser?.id,
          email: createdUser?.email || email,
        },
        session: null,
        needsEmailVerification: true,
        verificationMode: "otp",
      });
    }

    const { data: signedIn, error: signInError } = await signInClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError || !signedIn.session) {
      logError("api/register:signIn", signInError);
      return res.status(200).json({
        user: {
          id: createdUser?.id,
          email: createdUser?.email || email,
        },
        session: null,
        needsEmailVerification: false,
        verificationMode: null,
        userId: createdUser?.id,
      });
    }

    return res.status(200).json({
      user: {
        id: signedIn.user.id,
        email: signedIn.user.email,
      },
      session: {
        access_token: signedIn.session.access_token,
        refresh_token: signedIn.session.refresh_token,
      },
      needsEmailVerification: false,
      verificationMode: null,
    });
  } catch (err) {
    logError("api/register", { message: err?.message || String(err) });
    captureApiException(err, { tags: { route: "register" } });
    return res.status(500).json({ error: "Registration failed" });
  }
}
