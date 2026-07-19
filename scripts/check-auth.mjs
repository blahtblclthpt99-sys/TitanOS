#!/usr/bin/env node
/**
 * Auth health check: providers, email signup/login smoke test.
 *
 * Usage: node scripts/check-auth.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const env = { ...process.env };
  for (const file of [".env.local", ".env.production", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || env[m[1]]) continue;
      env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const anon = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const settings = await fetch(`${url}/auth/v1/settings`, {
  headers: { apikey: anon, Authorization: `Bearer ${anon}` },
}).then((r) => r.json());

const googleOn = Boolean(settings?.external?.google);
const emailOn = Boolean(settings?.external?.email);

console.log("Supabase Auth settings");
console.log(`  email:  ${emailOn ? "ON" : "OFF"}`);
console.log(`  google: ${googleOn ? "ON" : "OFF"}`);
console.log(`  azure:  ${settings?.external?.azure ? "ON" : "OFF"}`);
console.log(`  apple:  ${settings?.external?.apple ? "ON" : "OFF"}`);

const redirectAllow = [
  "https://titanos-web.vercel.app/auth/callback",
  "com.titanos.myapp://auth/callback",
];
console.log("\nRedirect URLs that must be allow-listed in Supabase:");
for (const u of redirectAllow) console.log(`  - ${u}`);

if (!googleOn) {
  console.log("\n⚠ Google is DISABLED. Follow GOOGLE_AUTH.md to enable it.");
}

const client = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false, flowType: "pkce" },
});

const stamp = Date.now();
const email = `authcheck+${stamp}@example.com`;
const password = `Test-${stamp}-Aa1!`;

console.log("\nEmail auth smoke test…");

async function smokeEmailAuth() {
  if (service) {
    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Auth Check" },
    });
    if (createError) throw createError;
    console.log(`  admin createUser OK (${created.user.id})`);
    const { error: inError } = await client.auth.signInWithPassword({ email, password });
    if (inError) throw inError;
    console.log("  signIn OK");
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("id,email,full_name,role")
      .eq("id", created.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    console.log(`  profile OK (${profile?.full_name || "no name"})`);
    await admin.auth.admin.deleteUser(created.user.id);
    console.log("  cleanup OK");
    return;
  }

  const { data: signUp, error: signUpError } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: "Auth Check" } },
  });
  if (signUpError) throw signUpError;
  console.log(`  signUp OK (user ${signUp.user?.id || "?"})`);
  if (!signUp.session) {
    console.log("  (needs email confirm — set SUPABASE_SERVICE_ROLE_KEY for full check)");
    return;
  }
  const { error: inError } = await client.auth.signInWithPassword({ email, password });
  if (inError) throw inError;
  console.log("  signIn OK");
}

try {
  await smokeEmailAuth();
} catch (err) {
  console.error("  email auth FAILED:", err.message || err);
  process.exit(1);
}

if (googleOn) {
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: "https://titanos-web.vercel.app/auth/callback",
      skipBrowserRedirect: true,
    },
  });
  if (error) {
    console.error("\nGoogle OAuth URL FAILED:", error.message);
    process.exit(1);
  }
  console.log("\nGoogle OAuth URL OK:");
  console.log(`  ${data.url?.slice(0, 120)}…`);
} else {
  console.log("\nSkipped Google OAuth URL (provider off).");
}

console.log("\nDone.");
process.exit(googleOn ? 0 : 2);
