#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  const env = {};
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}

const env = loadEnv(".env.local");
const url = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "")
  .replace(/\/+$/, "")
  .replace(/\/rest\/v1$/i, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error("Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY");
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const checks = [
  ["customers", "source", "legacy_csv_import"],
  ["jobs", "customer_name", "Smith Family"],
  ["invoices", "invoice_number", "INV-100231"],
  ["expenses", "vendor", "Shell Station"],
  ["equipment", "serial_number", "TXN-4471"],
  ["legacy_shifts", null, null],
  ["legacy_learning_scripts", null, null],
];

const out = {};
for (const [table, col, val] of checks) {
  let q = sb.from(table).select("id", { count: "exact", head: true });
  if (col && val) q = q.eq(col, val);
  const { count, error } = await q;
  out[table] = error
    ? { error: error.message }
    : { count: count ?? 0, filter: col ? `${col}=${val}` : "all" };
}

console.log(JSON.stringify(out, null, 2));
