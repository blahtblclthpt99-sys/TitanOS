import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseAdmin,
  getSupabaseAnonKey,
  readJson,
  standardSupabaseProjectRef,
} from "./_lib/supabase.js";
import { recordSignupEmail } from "./_lib/recordSignupEmail.js";
import { applyCors, handleOptions } from "./_lib/cors.js";
import { assertRateLimitAsync } from "./_lib/rateLimit.js";
import { createSignupWithConfirmation, sendExistingSignupOtp } from "./_lib/signupConfirmation.js";
import { logError } from "./_lib/safeLog.js";
import { captureApiException } from "./_lib/sentry.js";

function isDuplicateSignupError(error) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "");
  return ["email_exists", "user_already_exists"].includes(code) || /already|registered|exists/i.test(message);
}

function isEmailNotConfirmed(error) {
  return String(error?.code || "").toLowerCase() === "email_not_confirmed" ||
    /email\s+not\s+confirmed/i.test(String(error?.message || ""));
}

function createServerAuthClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = getSupabaseAnonKey();
  if (!url || !anon) {
    const error = new Error("Server auth is misconfigured");
    error.code = "SERVER_AUTH_MISCONFIGURED";
    throw error;
  }
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function recoverUnconfirmedSignup(admin, { email, password }) {
  const client = createServerAuthClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (!error || data?.session) return null;
  if (!isEmailNotConfirmed(error)) return null;

  return sendExistingSignupOtp(admin, { email });
}

function registrationErrorResponse(res, error) {
  const message = String(error?.message || "");
  if (isDuplicateSignupError(error)) {
    return res.status(409).json({
      error: "Could not create or resume this account. Try signing in or resetting your password.",
      code: "ACCOUNT_UNAVAILABLE",
    });
  }
  if (/password|weak|least/i.test(message)) {
    return res.status(400).json({
      error: "Password does not meet requirements",
      code: "WEAK_PASSWORD",
    });
  }
  if (String(error?.code || "").startsWith("SIGNUP_")) {
    logError("api/register:confirmation", { code: error.code, message });
    return res.status(424).json({
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

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify the calling browser's canonical hosted Supabase project before the
  // durable limiter or any other service-role path can touch persistence.
  const body = readJson(req);
  const clientProjectRef = String(body.clientProjectRef || "").trim().toLowerCase();
  const serverProjectRef = standardSupabaseProjectRef(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  );
  if (clientProjectRef && !/^[a-z0-9]+$/.test(clientProjectRef)) {
    return res.status(400).json({ error: "Invalid registration environment" });
  }
  if (clientProjectRef && serverProjectRef && clientProjectRef !== serverProjectRef) {
    return res.status(409).json({
      error: "Signup environment changed. Reload TitanOS and try again.",
      code: "AUTH_ENVIRONMENT_MISMATCH",
    });
  }

  if (!(await assertRateLimitAsync(req, res, {
    limit: 8,
    windowMs: 60 * 60 * 1000,
    key: "register",
    requireDurable: true,
    durableUnavailableStatus: 424,
  }))) {
    return;
  }

  try {
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
    let verificationType = null;
    let signInClient = null;

    if (requireConfirm) {
      try {
        const generated = await createSignupWithConfirmation(admin, {
          email,
          password,
          fullName,
        });
        createdUser = generated.user;
        verificationType = generated.verificationType;
      } catch (createError) {
        if (isDuplicateSignupError(createError)) {
          try {
            const recovered = await recoverUnconfirmedSignup(admin, { email, password });
            if (recovered?.user?.id) {
              createdUser = recovered.user;
              verificationType = recovered.verificationType;
            } else {
              return registrationErrorResponse(res, createError);
            }
          } catch (recoveryError) {
            if (String(recoveryError?.code || "").startsWith("SIGNUP_")) {
              return registrationErrorResponse(res, recoveryError);
            }
            return registrationErrorResponse(res, createError);
          }
        } else {
          return registrationErrorResponse(res, createError);
        }
      }
    } else {
      try {
        signInClient = createServerAuthClient();
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }

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

    if (createdUser?.id && !requireConfirm) {
      try {
        await admin.rpc("claim_founding_slot", { p_user_id: createdUser.id });
      } catch {
        /* optional Founding schema may not exist; ignore */
      }
    }

    if (requireConfirm) {
      return res.status(200).json({
        projectRef: serverProjectRef || null,
        user: {
          id: createdUser?.id,
          email: createdUser?.email || email,
        },
        session: null,
        needsEmailVerification: true,
        verificationMode: verificationType === "magiclink" ? "otp_magiclink" : "otp",
      });
    }

    const { data: signedIn, error: signInError } = await signInClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError || !signedIn.session) {
      logError("api/register:signIn", signInError);
      return res.status(200).json({
        projectRef: serverProjectRef || null,
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
      projectRef: serverProjectRef || null,
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
