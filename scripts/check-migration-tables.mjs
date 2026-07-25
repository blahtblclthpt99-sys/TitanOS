import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = loadEnv(".env.local");
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log(JSON.stringify({ error: "missing url or service role" }));
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function check(table) {
  const { error } = await sb.from(table).select("*", { count: "exact", head: true });
  if (!error) return { table, exists: true };
  const msg = error.message || "";
  if (
    /does not exist|Could not find the table|schema cache/i.test(msg) ||
    error.code === "42P01" ||
    error.code === "PGRST205"
  ) {
    return { table, exists: false, detail: msg };
  }
  return { table, exists: "unknown", detail: msg, code: error.code };
}

const results = [];
for (const t of ["stripe_webhook_events", "fee_rules", "fee_categories", "hire_applications"]) {
  results.push(await check(t));
}

const ref = url.replace(/^https:\/\//, "").split(".")[0];
console.log(JSON.stringify({ projectRef: ref, results }, null, 2));
