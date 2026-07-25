import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
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

const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
const anon = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const admin = createClient(url, service, { auth: { persistSession: false } });

async function tableOk(name) {
  const { error } = await admin.from(name).select("*", { count: "exact", head: true });
  if (!error) return { table: name, exists: true };
  return {
    table: name,
    exists: /does not exist|PGRST205|schema cache/i.test(error.message || "") ? false : "unknown",
    detail: error.message,
  };
}

const tables = [];
for (const t of ["driver_profiles", "stripe_webhook_events", "fee_rules"]) {
  tables.push(await tableOk(t));
}

// Probe id_verified lock (023) if driver_profiles exists
let idVerifiedProbe = { skipped: true };
if (tables[0].exists === true) {
  const email = `rc-probe-${Date.now()}@titanos.invalid`;
  const password = `Probe!Aa1${Date.now().toString().slice(-4)}`;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (cErr || !created?.user?.id) {
    idVerifiedProbe = { ok: false, error: cErr?.message || "create_failed" };
  } else {
    const uid = created.user.id;
    const user = createClient(url, anon, { auth: { persistSession: false } });
    await user.auth.signInWithPassword({ email, password });
    await user.from("driver_profiles").upsert(
      {
        user_id: uid,
        created_by_id: uid,
        name: "RC Probe",
        published: false,
        id_verified: true,
      },
      { onConflict: "user_id" }
    );
    const { data: row } = await admin
      .from("driver_profiles")
      .select("id_verified")
      .eq("user_id", uid)
      .maybeSingle();
    idVerifiedProbe = {
      blocked: row?.id_verified !== true,
      final: row?.id_verified ?? null,
      interpretation:
        row?.id_verified !== true
          ? "PASS — client cannot set id_verified (023 likely applied)"
          : "FAIL — client set id_verified (023 missing)",
    };
    await admin.from("driver_profiles").delete().eq("user_id", uid);
    await admin.auth.admin.deleteUser(uid);
  }
}

console.log(JSON.stringify({ tables, idVerifiedProbe }, null, 2));
