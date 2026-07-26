/**
 * Purge founder seed rows (owner_year_seed_v1) and reset inflated profile stats.
 * Does NOT re-seed.
 *
 * Usage: node --env-file=.env.local scripts/purge-owner-seed.mjs
 */
import { createClient } from "@supabase/supabase-js";

const OWNER_EMAILS = [
  process.env.OWNER_SEED_EMAIL,
  "mlafferty1991@yahoo.com",
  "blahtblclthpt99@gmail.com",
]
  .filter(Boolean)
  .map((e) => String(e).toLowerCase());

const SEED_TAG = "owner_year_seed_v1";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserIdByEmail(email) {
  const { data: byProfile } = await admin.from("profiles").select("id, email").ilike("email", email).maybeSingle();
  if (byProfile?.id) return byProfile.id;

  let page = 1;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = (data?.users || []).find((u) => (u.email || "").toLowerCase() === email);
    if (hit) return hit.id;
    if (!data?.users?.length || data.users.length < 200) break;
    page += 1;
  }
  return null;
}

async function purgeOne(email) {
  console.log(`\n=== Purging fake seed for: ${email} ===`);
  const userId = await findUserIdByEmail(email);
  if (!userId) {
    console.error(`No auth user for ${email}. Skipping.`);
    return false;
  }

  const { data: oldCust } = await admin
    .from("customers")
    .select("id")
    .eq("created_by_id", userId)
    .eq("source", SEED_TAG);
  const ids = (oldCust || []).map((c) => c.id);
  console.log(`Seed customers found: ${ids.length}`);

  const { error: invErr } = await admin
    .from("invoices")
    .delete()
    .eq("created_by_id", userId)
    .like("notes", `%${SEED_TAG}%`);
  if (invErr) console.warn("invoices:", invErr.message);

  const { error: jobErr } = await admin
    .from("jobs")
    .delete()
    .eq("created_by_id", userId)
    .like("notes", `%${SEED_TAG}%`);
  if (jobErr) console.warn("jobs:", jobErr.message);

  const { error: expErr } = await admin
    .from("expenses")
    .delete()
    .eq("created_by_id", userId)
    .like("notes", `%${SEED_TAG}%`);
  if (expErr) console.warn("expenses:", expErr.message);

  const { error: estErr } = await admin
    .from("estimates")
    .delete()
    .eq("created_by_id", userId)
    .like("notes", `%${SEED_TAG}%`);
  if (estErr) console.warn("estimates:", estErr.message);

  if (ids.length) {
    const { error: custErr } = await admin.from("customers").delete().in("id", ids);
    if (custErr) console.warn("customers:", custErr.message);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("professional_profile, full_name")
    .eq("id", userId)
    .maybeSingle();

  const pp =
    profile?.professional_profile && typeof profile.professional_profile === "object"
      ? { ...profile.professional_profile }
      : {};

  // Strip fake infinity stats / demo bio fluff; keep real name/slug if present
  if (pp.jobs_completed === 999999 || pp.jobs_completed > 10000) {
    pp.jobs_completed = 0;
  }
  if (Array.isArray(pp.badges)) {
    pp.badges = pp.badges.filter((b) => b !== "top_rated");
  }
  if (typeof pp.bio === "string" && /year-round HVAC|Building TitanOS while running/i.test(pp.bio)) {
    pp.bio = "";
  }
  if (typeof pp.headline === "string" && /Founder · TitanOS/i.test(pp.headline)) {
    pp.headline = "TitanOS operator";
  }

  const { error: ppErr } = await admin
    .from("profiles")
    .update({
      professional_profile: pp,
      verification_notes: null,
    })
    .eq("id", userId);
  if (ppErr) console.warn("profile reset:", ppErr.message);
  else console.log("Inflated professional_profile stats cleared.");

  console.log(`Purge complete for ${email}`);
  return true;
}

async function main() {
  console.log(`Purging seed tag ${SEED_TAG} for: ${[...new Set(OWNER_EMAILS)].join(", ")}`);
  for (const email of [...new Set(OWNER_EMAILS)]) {
    await purgeOne(email);
  }
  console.log("\nDone. Fake seed data removed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
