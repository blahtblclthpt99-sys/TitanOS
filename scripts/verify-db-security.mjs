/**
 * Live DB security verification for launch blockers (019 / 021).
 *
 * Probes real RLS + triggers via authenticated client attempts.
 * Does NOT print secrets. Requires .env.local with:
 *   VITE_SUPABASE_URL (or SUPABASE_URL)
 *   VITE_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run: node scripts/verify-db-security.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

function loadEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const anon = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon || !service) {
  console.log(
    JSON.stringify({
      ok: false,
      error: "missing_url_anon_or_service_role",
    })
  );
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function tableExists(table) {
  const { error } = await admin.from(table).select("*", { count: "exact", head: true });
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

function stamp() {
  return randomBytes(4).toString("hex");
}

async function main() {
  const report = {
    projectRef: url.replace(/^https:\/\//, "").split(".")[0],
    ts: new Date().toISOString(),
    tables: [],
    probes: {},
    conclusion: {},
  };

  for (const t of [
    "stripe_webhook_events",
    "fee_rules",
    "fee_categories",
    "hire_applications",
    "payments",
    "invoices",
    "profiles",
  ]) {
    report.tables.push(await tableExists(t));
  }

  const email = `launch-probe-${stamp()}@titanos.invalid`;
  const password = `Probe!${stamp()}Aa1`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created?.user?.id) {
    report.probes.userCreate = { ok: false, error: createErr?.message || "no_user" };
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }
  const userId = created.user.id;
  report.probes.userCreate = { ok: true, userId };

  const userClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signErr } = await userClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signErr) {
    report.probes.signIn = { ok: false, error: signErr.message };
    await admin.auth.admin.deleteUser(userId);
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }
  report.probes.signIn = { ok: true };

  // Ensure profile row exists (trigger may create it)
  await admin.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: "Launch Probe",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  // --- Payment insert as authenticated ---
  const { data: payRow, error: payInsErr } = await userClient
    .from("payments")
    .insert({
      amount: 12.34,
      status: "pending",
      created_by_id: userId,
      user_id: userId,
      note: "launch-probe",
    })
    .select("id, status")
    .maybeSingle();

  report.probes.paymentInsert = {
    ok: !payInsErr && Boolean(payRow?.id),
    error: payInsErr?.message || null,
    id: payRow?.id || null,
  };

  if (payRow?.id) {
    const { data: afterPay, error: payUpErr } = await userClient
      .from("payments")
      .update({ status: "succeeded" })
      .eq("id", payRow.id)
      .select("id, status")
      .maybeSingle();

    // RLS may return empty (no row) or error; either way status must not become succeeded
    let finalStatus = afterPay?.status;
    if (!afterPay) {
      const { data: check } = await admin
        .from("payments")
        .select("status")
        .eq("id", payRow.id)
        .maybeSingle();
      finalStatus = check?.status;
    }

    const blocked =
      Boolean(payUpErr) ||
      finalStatus !== "succeeded" ||
      afterPay == null;

    report.probes.paymentClientSucceeded = {
      blocked: finalStatus !== "succeeded",
      finalStatus,
      clientError: payUpErr?.message || null,
      emptySelect: afterPay == null && !payUpErr,
      interpretation:
        finalStatus !== "succeeded"
          ? "PASS — client cannot mark payment succeeded (019 likely applied)"
          : "FAIL — client marked payment succeeded (019 missing or weak)",
    };
  }

  // --- Invoice paid attempt ---
  const { data: invRow, error: invInsErr } = await userClient
    .from("invoices")
    .insert({
      status: "sent",
      total: 50,
      balance_due: 50,
      created_by_id: userId,
      customer_name: "Launch Probe Customer",
    })
    .select("id, status")
    .maybeSingle();

  report.probes.invoiceInsert = {
    ok: !invInsErr && Boolean(invRow?.id),
    error: invInsErr?.message || null,
    id: invRow?.id || null,
  };

  if (invRow?.id) {
    const { error: invUpErr } = await userClient
      .from("invoices")
      .update({ status: "paid" })
      .eq("id", invRow.id);

    const { data: invCheck } = await admin
      .from("invoices")
      .select("status")
      .eq("id", invRow.id)
      .maybeSingle();

    report.probes.invoiceClientPaid = {
      blocked: invCheck?.status !== "paid",
      finalStatus: invCheck?.status || null,
      clientError: invUpErr?.message || null,
      interpretation:
        invCheck?.status !== "paid"
          ? "PASS — client cannot set invoice paid (021 trigger likely applied)"
          : "FAIL — client set invoice paid (021 missing or weak)",
    };
  }

  // --- Profile privilege escalation ---
  const { error: profErr } = await userClient
    .from("profiles")
    .update({ role: "admin", is_pro: true, plan_tier: "enterprise" })
    .eq("id", userId);

  const { data: profCheck } = await admin
    .from("profiles")
    .select("role, is_pro, plan_tier")
    .eq("id", userId)
    .maybeSingle();

  const roleEscalated =
    String(profCheck?.role || "").toLowerCase() === "admin" ||
    profCheck?.is_pro === true ||
    String(profCheck?.plan_tier || "").toLowerCase() === "enterprise";

  report.probes.profilePrivilegeEscalation = {
    blocked: !roleEscalated,
    role: profCheck?.role ?? null,
    is_pro: profCheck?.is_pro ?? null,
    plan_tier: profCheck?.plan_tier ?? null,
    clientError: profErr?.message || null,
    interpretation: !roleEscalated
      ? "PASS — privilege columns protected (021 trigger likely applied)"
      : "FAIL — privilege escalation succeeded (021 missing or weak)",
  };

  // Cleanup probe rows
  if (payRow?.id) await admin.from("payments").delete().eq("id", payRow.id);
  if (invRow?.id) await admin.from("invoices").delete().eq("id", invRow.id);
  await admin.from("profiles").delete().eq("id", userId);
  await admin.auth.admin.deleteUser(userId);
  report.probes.cleanup = { ok: true };

  const payOk = report.probes.paymentClientSucceeded?.blocked === true;
  const invOk = report.probes.invoiceClientPaid?.blocked === true;
  const profOk = report.probes.profilePrivilegeEscalation?.blocked === true;
  const webhookTable = report.tables.find((t) => t.table === "stripe_webhook_events")?.exists === true;

  report.conclusion = {
    migration_018_idempotency_table: webhookTable ? "confirmed" : "missing",
    migration_019_payment_lockdown: payOk ? "confirmed_by_behavior" : "FAILED_or_unverified",
    migration_021_privilege_money: invOk && profOk ? "confirmed_by_behavior" : "FAILED_or_partial",
    invoice_paid_block: invOk,
    profile_privilege_block: profOk,
    overall: payOk && invOk && profOk && webhookTable ? "PASS" : "NEEDS_ACTION",
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.conclusion.overall === "PASS" ? 0 : 3);
}

main().catch((err) => {
  console.log(JSON.stringify({ ok: false, error: String(err?.message || err) }, null, 2));
  process.exit(1);
});
