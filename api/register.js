import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin, getSupabaseAnonKey, readJson } from "./_lib/supabase.js";
import { recordSignupEmail } from "./_lib/recordSignupEmail.js";
import { applyCors, handleOptions } from "./_lib/cors.js";
import { assertRateLimit } from "./_lib/rateLimit.js";
import { logError } from "./_lib/safeLog.js";
import { captureApiException } from "./_lib/sentry.js";

const ACCOUNT_TYPES = new Set(["job_seeker", "business"]);

/**
 * Server-side registration.
 * Production (VERCEL_ENV=production) requires email confirm unless
 * REGISTER_REQUIRE_EMAIL_CONFIRM is explicitly set to "false".
 * Non-production defaults to auto-confirm for closed beta — still rate-limited.
 */
export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!assertRateLimit(req, res, { limit: 8, windowMs: 60 * 60 * 1000, key: "register" })) {
    return;
  }

  try {
    const body = readJson(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const fullName = String(body.fullName || body.full_name || "").trim();
    const requestedAccountType = String(body.accountType || body.account_type || "job_seeker").trim().toLowerCase();
    const accountType = ACCOUNT_TYPES.has(requestedAccountType) ? requestedAccountType : "job_seeker";
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
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: !requireConfirm,
      user_metadata: {
        ...(fullName ? { full_name: fullName } : {}),
        account_type: accountType,
      },
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

    await recordSignupEmail(admin, { email, fullName, source: `register:${accountType}` });

    if (created.user?.id) {
      // Founding claim first so choosing a UX experience cannot overwrite a real
      // subscription/founding plan. account_type is product UX, plan_tier is billing.
      try {
        await admin.rpc("claim_founding_slot", { p_user_id: created.user.id });
      } catch {
        /* trigger may already have claimed; ignore */
      }

      try {
        const { data: profile } = await admin
          .from("profiles")
          .select("plan_tier")
          .eq("id", created.user.id)
          .maybeSingle();
        const row = {
          id: created.user.id,
          ...(fullName ? { full_name: fullName } : {}),
          account_type: accountType,
        };
        if (!String(profile?.plan_tier || "").trim()) row.plan_tier = "worker_free";
        const { error: profileError } = await admin
          .from("profiles")
          .upsert(row, { onConflict: "id" });
        if (profileError) throw profileError;
      } catch (profileError) {
        // Do not orphan an Auth account because profile enrichment failed. The
        // app treats an unclassified legacy account as job_seeker and the user
        // can choose again from Account Type after sign-in.
        logError("api/register:accountType", profileError);
      }
    }

    if (requireConfirm) {
      return res.status(200).json({
        user: {
          id: created.user?.id,
          email: created.user?.email || email,
        },
        accountType,
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
        accountType,
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
      accountType,
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
