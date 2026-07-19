#!/usr/bin/env node
/**
 * Apply TitanOS Auth URL config via Supabase Management API.
 *
 * Requires SUPABASE_ACCESS_TOKEN (Account → Access Tokens) in .env.local
 * Does NOT enable Google (needs Google Client ID/Secret in dashboard).
 *
 * Usage: node scripts/fix-supabase-auth.mjs
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const env = { ...process.env };
  for (const file of [".env.local", ".env"]) {
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

const PROJECT_REF = "xcfjpxcmokdfwkarwomy";
const env = loadEnv();
const token = env.SUPABASE_ACCESS_TOKEN;

if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN in .env.local");
  console.error("Create one: https://supabase.com/dashboard/account/tokens");
  process.exit(1);
}

const siteUrl = "https://titanos-web.vercel.app";
const redirectUrls = [
  "https://titanos-web.vercel.app/auth/callback",
  "https://titanos-web.vercel.app/reset-password",
  "https://titanfieldos.com/auth/callback",
  "https://titanfieldos.com/reset-password",
  "http://localhost:5173/auth/callback",
  "http://localhost:5173/reset-password",
  "com.titanos.myapp://auth/callback",
].join(",");

const patch = {
  SITE_URL: siteUrl,
  URI_ALLOW_LIST: redirectUrls,
  // Confirm email off → no built-in mailer spam / rate limits for Play testers
  MAILER_AUTOCONFIRM: true,
  DISABLE_SIGNUP: false,
};

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(patch),
});

const text = await res.text();
if (!res.ok) {
  console.error("Auth config update failed:", res.status, text.slice(0, 800));
  process.exit(1);
}

console.log("Updated Supabase Auth config:");
console.log("  SITE_URL =", siteUrl);
console.log("  MAILER_AUTOCONFIRM = true");
console.log("  Redirect allow-list set (", redirectUrls.split(",").length, "URLs )");
console.log("\nGoogle is still configured in the dashboard (see GOOGLE_AUTH.md).");
