import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin, getSupabaseAnonKey, readJson } from "./_lib/supabase.js";
import { recordSignupEmail } from "./_lib/recordSignupEmail.js";
import { applyCors, handleOptions } from "./_lib/cors.js";
import { assertRateLimitAsync } from "./_lib/rateLimit.js";
import { logError } from "./_lib/safeLog.js";
import { captureApiException } from "./_lib/sentry.js";

/**
 * Server-side registration.
 * Email confirmation is required by default on every runtime. Closed/internal
 * test environments may explicitly set REGISTER_REQUIRE_EMAIL_CONFIRM=false.
 * Production also requires a durable cross-instance rate-limit backend.
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
    const flag = String(process.env.REGISTER_REQUIRE_EMAIL_CONFIRM || "").trim().toLowerCase();
    const requireConfirm = flag !== "false";

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
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: !requireConfirm,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    });

    if (createError) {
      const msg = String(createError.message || "");
      if (/already|registered|exists/i.test(msg)) {
        return res.status(409).json({
          error: "An account with this email already exists",
          code: "EMAIL_TAKEN",
        });
      }
      if (/password|weak|least/i.test(msg)) {
        return res.status(400).json({
          error: "Password does not meet requirements",
          code: "WEAK_PASSWORD",
        });
      }
      logError("api/register:createUser", createError);
      return res.status(400).json({
        error: "Could not create account. Check your email and password.",
        code: "REGISTER_FAILED",
      });
    }

    await recordSignupEmail(admin, { email, fullName, source: "register" });

    // Founding 100 claim (also runs from profiles AFTER INSERT trigger — best-effort here)
    if (created.user?.id) {
      try {
        await admin.rpc("claim_founding_slot", { p_user_id: created.user.id });
      } catch {
        /* trigger may already have claimed; ignore */
      }
    }

    if (requireConfirm) {
      return res.status(200).json({
        user: {
          id: created.user?.id,
          email: created.user?.email || email,
        },
        session: null,
        needsEmailVerification: true,
        verificationMode: "email_link",
      });
    }

    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const anon = getSupabaseAnonKey();
    if (!url || !anon) {
      return res.status(500).json({ error: "Server auth is misconfigured" });
    }

    const client = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signedIn, error: signInError } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError || !signedIn.session) {
      logError("api/register:signIn", signInError);
      return res.status(200).json({
        user: {
          id: created.user?.id,
          email: created.user?.email || email,
        },
        session: null,
        needsEmailVerification: true,
        verificationMode: "email_link",
        userId: created.user?.id,
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
    });
  } catch (err) {
    logError("api/register", { message: err?.message || String(err) });
    captureApiException(err, { tags: { route: "register" } });
    return res.status(500).json({ error: "Registration failed" });
  }
}
