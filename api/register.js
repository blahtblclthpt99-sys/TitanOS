import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin, getSupabaseAnonKey, readJson } from "./_lib/supabase.js";
import { recordSignupEmail } from "./_lib/recordSignupEmail.js";

/**
 * Server-side registration that bypasses Supabase's built-in email rate limit.
 * Creates a confirmed user and returns a session (access + refresh tokens).
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = readJson(req);
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const fullName = String(body.fullName || body.full_name || "").trim();

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email is required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const admin = getSupabaseAdmin();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    });

    if (createError) {
      const msg = createError.message || "Registration failed";
      const status = /already|registered|exists/i.test(msg) ? 409 : 400;
      return res.status(status).json({ error: msg });
    }

    // Persist signup email to data/signup-emails.txt + durable DB (never blocks signup)
    await recordSignupEmail(admin, { email, fullName, source: "register" });

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
      return res.status(500).json({
        error: signInError?.message || "Account created but sign-in failed. Try logging in.",
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
    console.error("[api/register]", err);
    return res.status(500).json({ error: err.message || "Registration failed" });
  }
}
