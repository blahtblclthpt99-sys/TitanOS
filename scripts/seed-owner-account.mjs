/**
 * Promote founder account(s) + seed one realistic year of field-business data.
 * ONLY affects owner emails listed below (or OWNER_SEED_EMAIL).
 *
 * Usage: node --env-file=.env.local scripts/seed-owner-account.mjs
 *        node --env-file=.env.local scripts/seed-owner-account.mjs --force
 */
import { createClient } from "@supabase/supabase-js";

const OWNER_EMAILS = [
  process.env.OWNER_SEED_EMAIL,
  "mlafferty1991@yahoo.com",
  "blahtblclthpt99@gmail.com",
]
  .filter(Boolean)
  .map((e) => String(e).toLowerCase());

const FORCE = process.argv.includes("--force");
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

const FIRST = ["Jordan", "Alex", "Sam", "Casey", "Riley", "Morgan", "Taylor", "Jamie", "Avery", "Quinn", "Drew", "Reese", "Cameron", "Harper", "Parker", "Skyler", "Rowan", "Finley", "Blake", "Hayden"];
const LAST = ["Nguyen", "Brooks", "Patel", "Garcia", "Kim", "Johnson", "Martinez", "Lee", "Wright", "Clark", "Adams", "Baker", "Torres", "Rivera", "Cooper", "Reed", "Bailey", "Bell", "Murphy", "Price"];
const SERVICES = ["HVAC tune-up", "AC repair", "Furnace service", "Duct cleaning", "Thermostat install", "Emergency call-out", "Filter replacement", "Heat pump service", "Mini-split install", "Maintenance plan visit"];
const CITIES = [
  { city: "Austin", state: "TX", zip: "78701" },
  { city: "Round Rock", state: "TX", zip: "78664" },
  { city: "Cedar Park", state: "TX", zip: "78613" },
  { city: "Pflugerville", state: "TX", zip: "78660" },
  { city: "Georgetown", state: "TX", zip: "78626" },
];
const EXPENSE_CATS = [
  ["Fuel", 45, 95],
  ["Parts & materials", 80, 420],
  ["Tools", 35, 280],
  ["Insurance", 180, 320],
  ["Phone / software", 40, 120],
  ["Marketing", 50, 250],
  ["Vehicle maintenance", 60, 380],
  ["Office supplies", 15, 75],
];

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function pick(arr, i) {
  return arr[i % arr.length];
}
function money(min, max, i) {
  const span = max - min;
  return Math.round((min + ((i * 37) % span) + span * 0.15) * 100) / 100;
}

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

async function seedOne(OWNER_EMAIL) {
  console.log(`\n=== Seeding owner account: ${OWNER_EMAIL} ===`);
  const userId = await findUserIdByEmail(OWNER_EMAIL);
  if (!userId) {
    console.error(`No auth user found for ${OWNER_EMAIL}. Skipping.`);
    return false;
  }
  console.log(`Found user id: ${userId}`);

  const { data: existingProfile } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const displayName = existingProfile?.full_name || "Matt Lafferty";

  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      role: "admin",
      is_pro: true,
      lifetime_premium: true,
      paying_subscriber: true,
      plan_tier: "business",
      account_type: "business",
      verified_worker: true,
      verification_notes: "Platform founder — full authority",
      full_name: displayName,
      company_name: "Titan Field Services",
      city: "Austin",
      state: "TX",
    })
    .eq("id", userId);
  if (profileErr) {
    console.error("Profile update failed:", profileErr.message);
    return false;
  }
  console.log("Authority flags set (admin / business / verified).");

  // Best-effort professional_profile JSON (migration 014 may be missing on some envs)
  const { error: ppErr } = await admin
    .from("profiles")
    .update({
      professional_profile: {
        display_name: displayName,
        slug: OWNER_EMAIL.startsWith("mlafferty") ? "mlafferty" : "titanos-founder",
        headline: "Founder · TitanOS · Field services operator",
        bio: "Building TitanOS while running a real service business. Verified operator with year-round HVAC and field work across Central Texas.",
        city: "Austin",
        state: "TX",
        public: true,
        verified: true,
        badges: ["verified", "top_rated", "founder"],
        skills: ["HVAC", "Field ops", "Estimating", "Crew leadership", "Customer care"],
        jobs_completed: 999999,
        social: {},
      },
    })
    .eq("id", userId);
  if (ppErr) {
    console.warn("professional_profile skipped:", ppErr.message);
  }

  try {
    await admin.auth.admin.updateUserById(userId, {
      app_metadata: { role: "admin", is_founder: true },
      user_metadata: { full_name: displayName, is_founder: true },
    });
  } catch (e) {
    console.warn("auth metadata update skipped:", e.message);
  }

  const { count: existingSeed } = await admin
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("created_by_id", userId)
    .eq("source", SEED_TAG);

  if (existingSeed > 0 && !FORCE) {
    console.log(`Seed already present (${existingSeed} customers). Authority updated.`);
    return true;
  }

  if (FORCE && existingSeed > 0) {
    console.log("Force: deleting prior owner seed rows…");
    const { data: oldCust } = await admin.from("customers").select("id").eq("created_by_id", userId).eq("source", SEED_TAG);
    const ids = (oldCust || []).map((c) => c.id);
    if (ids.length) {
      await admin.from("invoices").delete().eq("created_by_id", userId).like("notes", `%${SEED_TAG}%`);
      await admin.from("jobs").delete().eq("created_by_id", userId).like("notes", `%${SEED_TAG}%`);
      await admin.from("expenses").delete().eq("created_by_id", userId).like("notes", `%${SEED_TAG}%`);
      await admin.from("estimates").delete().eq("created_by_id", userId).like("notes", `%${SEED_TAG}%`);
      await admin.from("customers").delete().in("id", ids);
    }
  }

  const customers = [];
  for (let i = 0; i < 52; i++) {
    const loc = pick(CITIES, i);
    const created = daysAgo(350 - i * 6);
    customers.push({
      created_by_id: userId,
      first_name: pick(FIRST, i),
      last_name: pick(LAST, i * 3),
      email: `${pick(FIRST, i).toLowerCase()}.${pick(LAST, i * 3).toLowerCase()}${i}@example.com`,
      phone: `512-555-${String(1000 + i).slice(-4)}`,
      address: `${100 + i} ${pick(["Oak", "Cedar", "Maple", "Ranch", "Lake"], i)} St`,
      city: loc.city,
      state: loc.state,
      zip: loc.zip,
      status: i % 7 === 0 ? "lead" : "active",
      source: SEED_TAG,
      notes: SEED_TAG,
      lifetime_value: 0,
      created_at: created.toISOString(),
      updated_at: created.toISOString(),
    });
  }

  const { data: custRows, error: custErr } = await admin.from("customers").insert(customers).select("id, first_name, last_name, city, state, address");
  if (custErr) throw custErr;
  console.log(`Customers: ${custRows.length}`);

  const jobs = [];
  for (let i = 0; i < 210; i++) {
    const cust = pick(custRows, i);
    const day = daysAgo(360 - Math.floor(i * 1.7));
    const amount = money(185, 980, i);
    const done = i < 195;
    jobs.push({
      created_by_id: userId,
      title: pick(SERVICES, i),
      description: `${pick(SERVICES, i)} for ${cust.first_name} ${cust.last_name}`,
      customer_id: cust.id,
      customer_name: `${cust.first_name} ${cust.last_name}`,
      status: done ? "completed" : i % 2 === 0 ? "scheduled" : "in_progress",
      priority: i % 11 === 0 ? "high" : "medium",
      service_type: pick(SERVICES, i).split(" ")[0],
      scheduled_date: isoDate(day),
      scheduled_time: `${8 + (i % 8)}:00`,
      address: cust.address,
      amount,
      notes: SEED_TAG,
      created_at: day.toISOString(),
      updated_at: day.toISOString(),
    });
  }
  const { data: jobRows, error: jobErr } = await admin.from("jobs").insert(jobs).select("id, amount, customer_id, customer_name, status, scheduled_date, created_at");
  if (jobErr) throw jobErr;
  console.log(`Jobs: ${jobRows.length}`);

  const invoices = [];
  let invNum = 1000;
  for (let i = 0; i < jobRows.length; i++) {
    const job = jobRows[i];
    if (job.status !== "completed") continue;
    const total = Number(job.amount);
    const paid = i % 9 !== 0;
    const overdue = !paid && i % 3 === 0;
    invoices.push({
      created_by_id: userId,
      invoice_number: `INV-${invNum++}`,
      customer_id: job.customer_id,
      customer_name: job.customer_name,
      job_id: job.id,
      status: paid ? "paid" : overdue ? "overdue" : "sent",
      line_items: [{ description: job.customer_name, amount: total, qty: 1 }],
      subtotal: total,
      tax_rate: 0.0825,
      tax_amount: Math.round(total * 0.0825 * 100) / 100,
      total: Math.round(total * 1.0825 * 100) / 100,
      amount_paid: paid ? Math.round(total * 1.0825 * 100) / 100 : 0,
      balance_due: paid ? 0 : Math.round(total * 1.0825 * 100) / 100,
      due_date: isoDate(new Date(new Date(job.created_at).getTime() + 14 * 86400000)),
      payment_method: paid ? (i % 2 === 0 ? "card" : "ach") : null,
      notes: SEED_TAG,
      created_at: job.created_at,
      updated_at: job.created_at,
    });
  }
  const { error: invErr } = await admin.from("invoices").insert(invoices);
  if (invErr) throw invErr;
  console.log(`Invoices: ${invoices.length}`);

  const expenses = [];
  for (let i = 0; i < 140; i++) {
    const [cat, min, max] = pick(EXPENSE_CATS, i);
    const day = daysAgo(350 - i * 2);
    expenses.push({
      created_by_id: userId,
      description: `${cat} — field ops`,
      amount: money(min, max, i),
      category: cat,
      date: isoDate(day),
      vendor: pick(["Home Depot", "Supply House", "Shell", "State Farm", "Verizon", "Facebook Ads", "AutoZone"], i),
      is_tax_deductible: true,
      tax_year: day.getFullYear(),
      business_use_percent: 100,
      notes: SEED_TAG,
      created_at: day.toISOString(),
      updated_at: day.toISOString(),
    });
  }
  const { error: expErr } = await admin.from("expenses").insert(expenses);
  if (expErr) throw expErr;
  console.log(`Expenses: ${expenses.length}`);

  const estimates = [];
  for (let i = 0; i < 18; i++) {
    const cust = pick(custRows, i + 5);
    const total = money(420, 2400, i);
    const day = daysAgo(40 - i);
    estimates.push({
      created_by_id: userId,
      estimate_number: `EST-${2000 + i}`,
      customer_id: cust.id,
      customer_name: `${cust.first_name} ${cust.last_name}`,
      status: i % 4 === 0 ? "accepted" : i % 3 === 0 ? "sent" : "draft",
      line_items: [{ description: pick(SERVICES, i), amount: total, qty: 1 }],
      subtotal: total,
      total,
      service_type: pick(SERVICES, i),
      address: cust.address,
      notes: SEED_TAG,
      valid_until: isoDate(daysAgo(-14)),
      created_at: day.toISOString(),
      updated_at: day.toISOString(),
    });
  }
  const { error: estErr } = await admin.from("estimates").insert(estimates);
  if (estErr) throw estErr;
  console.log(`Estimates: ${estimates.length}`);

  for (const cust of custRows) {
    const paid = invoices.filter((inv) => inv.customer_id === cust.id && inv.status === "paid");
    const ltv = paid.reduce((s, inv) => s + Number(inv.total || 0), 0);
    if (ltv > 0) {
      await admin.from("customers").update({ lifetime_value: Math.round(ltv * 100) / 100 }).eq("id", cust.id);
    }
  }

  const paidTotal = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.total), 0);
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  console.log(`Paid invoice volume (year): $${paidTotal.toLocaleString()}`);
  console.log(`Expenses (year): $${expenseTotal.toLocaleString()}`);
  console.log(`Approx net: $${(paidTotal - expenseTotal).toLocaleString()}`);
  return true;
}

async function main() {
  console.log(`Owner emails: ${[...new Set(OWNER_EMAILS)].join(", ")}`);
  for (const email of [...new Set(OWNER_EMAILS)]) {
    await seedOne(email);
  }
  console.log("\nOwner seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
