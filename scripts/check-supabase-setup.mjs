#!/usr/bin/env node
/**
 * Validates Supabase connectivity and TitanOS schema.
 *
 * Usage: node scripts/check-supabase-setup.mjs
 *
 * Requires in .env.local:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY (optional but recommended)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const TABLES = [
  "profiles",
  "customers",
  "jobs",
  "invoices",
  "estimates",
  "expenses",
  "employees",
  "mileage_trips",
  "marketplace_modules",
  "module_installs",
  "module_waitlists",
  "developer_applications",
  "referrals",
  "beta_signups",
  "beta_feedbacks",
  "portal_sessions",
  // Platform expansion (002)
  "marketplace_listings",
  "marketplace_favorites",
  "marketplace_reports",
  "marketplace_messages",
  "marketplace_reviews",
  "hire_jobs",
  "hire_applications",
  "community_posts",
  "community_likes",
  "community_comments",
  "activity_events",
  "notifications",
  "job_reviews",
  "price_estimates",
];

function loadEnvFiles() {
  const env = { ...process.env };
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      const key = line.slice(0, i).trim();
      const value = line.slice(i + 1).trim();
      if (!(key in env) || file === ".env.local") env[key] = value;
    }
  }
  return env;
}

const env = loadEnvFiles();
for (const key of ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]) {
  if (!env[key]) {
    console.error(`Missing ${key} in .env.local`);
    process.exit(1);
  }
}

const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const anon = createClient(url, anonKey);
const admin = serviceKey
  ? createClient(url, serviceKey, { auth: { persistSession: false } })
  : null;

function ok(label, detail = "") {
  console.log(`OK  ${label}${detail ? ` — ${detail}` : ""}`);
}
function warn(label, detail = "") {
  console.log(`WARN ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label, detail = "") {
  console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

async function checkTable(client, table) {
  const { error } = await client.from(table).select("id", { head: true, count: "exact" });
  if (error) {
    fail(`Table ${table}`, error.message);
    return false;
  }
  ok(`Table ${table}`);
  return true;
}

async function main() {
  console.log("TitanOS Supabase setup check\n");
  ok("Env", url);

  if (!admin) warn("SUPABASE_SERVICE_ROLE_KEY not set — skipping admin checks");

  const client = admin || anon;
  let tablesOk = 0;
  for (const table of TABLES) {
    if (await checkTable(client, table)) tablesOk += 1;
  }
  if (tablesOk === 0) {
    fail("Schema", "No tables found — run supabase/migrations/001_titanos_schema.sql");
    process.exit(1);
  }

  const settingsRes = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  const settings = settingsRes.ok ? await settingsRes.json() : null;
  if (settings?.external?.google) {
    ok("Google Auth", "provider enabled");
  } else {
    warn("Google Auth", "disabled in Supabase — see GOOGLE_AUTH.md");
  }

  // Public signup often hits built-in mailer rate limits; server /api/register bypasses that.
  warn(
    "Public email signup",
    settings?.mailer_autoconfirm
      ? "autoconfirm ON"
      : "autoconfirm OFF (use /api/register on Vercel)"
  );

  if (admin) {
    const { data: bucketList, error: bucketError } = await admin.storage.listBuckets();
    if (bucketError) warn("Storage", bucketError.message);
    else if (bucketList?.some((b) => b.id === "titanos-uploads")) ok("Storage bucket titanos-uploads");
    else warn("Storage bucket titanos-uploads missing — re-run migration SQL");
  }

  console.log("\nPlay / OAuth redirects to allow in Supabase Auth:");
  console.log("  https://titanos-web.vercel.app/auth/callback");
  console.log("  http://localhost:5173/auth/callback");
  console.log("  com.titanos.myapp://auth/callback");
  console.log("\nOptional: node scripts/fix-supabase-auth.mjs (needs SUPABASE_ACCESS_TOKEN)");
  console.log("Upload to Play Console: release/TitanOS.aab (com.titanos.myapp)");
}

main().catch((error) => {
  fail("Setup check failed", error.message);
  process.exit(1);
});
