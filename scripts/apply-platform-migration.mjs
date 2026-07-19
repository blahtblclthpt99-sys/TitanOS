#!/usr/bin/env node
/**
 * Applies supabase/migrations/002_platform_expansion.sql using the service role key.
 * Usage: node scripts/apply-platform-migration.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const env = { ...process.env };
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!env[key]) env[key] = val;
    }
  }
  return env;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sqlPath = resolve(process.cwd(), "supabase/migrations/002_platform_expansion.sql");
const sql = readFileSync(sqlPath, "utf8");

console.log("Applying 002_platform_expansion.sql …");
console.log("NOTE: Supabase JS client cannot run arbitrary SQL DDL.");
console.log("Open the Supabase SQL editor and paste:");
console.log(`  ${sqlPath}`);
console.log("Or run: npx supabase db push");
console.log(`Project: ${url}`);
console.log(`SQL length: ${sql.length} chars`);

// Smoke-check connectivity
const supabase = createClient(url, key, { auth: { persistSession: false } });
const { error } = await supabase.from("profiles").select("id").limit(1);
if (error) {
  console.error("Connectivity check failed:", error.message);
  process.exit(1);
}
console.log("Connectivity OK. Apply the SQL file in the dashboard to finish.");
