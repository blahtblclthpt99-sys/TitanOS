import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.VITE_SUPABASE_URL;
const anon = env.VITE_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
const client = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });

const email = `playtest+${Date.now()}@titanos.app`;
const password = "TitanOS-Test-2026!";

const tables = ["profiles", "customers", "jobs", "invoices", "estimates", "expenses"];
for (const t of tables) {
  const { error } = await admin.from(t).select("id").limit(1);
  console.log(error ? `TABLE_FAIL ${t}: ${error.message}` : `TABLE_OK ${t}`);
}

const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: "Play Tester" },
});
if (createErr) {
  console.error("REGISTER_FAIL", createErr.message);
  process.exit(1);
}
console.log("REGISTER_OK", created.user.id);

// Allow trigger a moment
await new Promise((r) => setTimeout(r, 500));

const { data: profile, error: profileErr } = await admin
  .from("profiles")
  .select("*")
  .eq("id", created.user.id)
  .maybeSingle();
console.log(
  profileErr
    ? `PROFILE_FAIL ${profileErr.message}`
    : `PROFILE_OK is_pro=${profile?.is_pro} role=${profile?.role} name=${profile?.full_name}`
);

const { data: login, error: loginErr } = await client.auth.signInWithPassword({ email, password });
if (loginErr) {
  console.error("LOGIN_FAIL", loginErr.message);
  process.exit(1);
}
console.log("LOGIN_OK", login.user.email);

const { error: custErr } = await client.from("customers").insert({
  first_name: "Test",
  last_name: "Customer",
  email: "cust@example.com",
  created_by_id: login.user.id,
});
console.log(custErr ? `CUSTOMER_FAIL ${custErr.message}` : "CUSTOMER_OK");

const { data: list, error: listErr } = await client
  .from("customers")
  .select("id,first_name")
  .eq("created_by_id", login.user.id);
console.log(listErr ? `LIST_FAIL ${listErr.message}` : `LIST_OK count=${list.length}`);

await admin.auth.admin.deleteUser(created.user.id);
console.log("CLEANUP_OK");
