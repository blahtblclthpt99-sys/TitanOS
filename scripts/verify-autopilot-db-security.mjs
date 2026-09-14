import { existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * Live Titan Autopilot DB security certification.
 *
 * Proves the Recovery Receipt trust boundary against a real Supabase project:
 * - owner can read its Autopilot receipt;
 * - authenticated client cannot update/delete that receipt;
 * - authenticated client cannot forge an autopilot_run:* queue row;
 * - ordinary non-Autopilot follow-ups remain writable;
 * - authenticated client cannot write launch telemetry directly.
 *
 * Required env (.env or .env.local):
 *   SUPABASE_URL or VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY
 *
 * Run: node scripts/verify-autopilot-db-security.mjs
 */

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[match[1]] = value;
  }
  return out;
}

const env = { ...loadEnv(".env"), ...loadEnv(".env.local"), ...process.env };
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!url || !serviceRole || !anonKey) {
  console.log(JSON.stringify({ ok: false, error: "missing_supabase_url_service_role_or_anon_key" }, null, 2));
  process.exit(1);
}

const admin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function token() {
  return randomBytes(6).toString("hex");
}

function errorSummary(error) {
  if (!error) return null;
  return { code: error.code || null, message: error.message || String(error) };
}

async function main() {
  const suffix = token();
  const email = `autopilot-rls-${suffix}@titanos.invalid`;
  const password = `TitanProbe!${token()}Aa1`;
  const report = {
    ok: false,
    ts: new Date().toISOString(),
    projectRef: String(url).replace(/^https:\/\//, "").split(".")[0],
    probes: {},
  };

  let userId = null;
  let receiptId = null;
  let manualId = null;

  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !created?.user?.id) throw createError || new Error("probe_user_not_created");
    userId = created.user.id;

    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;

    const deliveryKey = `autopilot_run:security_probe:${suffix}`;
    const { data: receipt, error: receiptError } = await admin
      .from("follow_up_queue")
      .insert({
        created_by_id: userId,
        user_id: userId,
        customer_name: "Autopilot Security Probe",
        customer_email: `recipient-${suffix}@titanos.invalid`,
        rule_id: deliveryKey,
        scheduled_for: new Date().toISOString(),
        status: "pending",
        channel: "email",
        message: "Security probe only — do not deliver.",
      })
      .select("id,status,rule_id")
      .single();
    if (receiptError || !receipt?.id) throw receiptError || new Error("receipt_probe_insert_failed");
    receiptId = receipt.id;

    const { data: readable, error: readError } = await client
      .from("follow_up_queue")
      .select("id,status,rule_id")
      .eq("id", receiptId)
      .maybeSingle();
    const receiptReadable = !readError && readable?.id === receiptId && readable?.rule_id === deliveryKey;
    report.probes.receiptReadable = {
      pass: receiptReadable,
      error: errorSummary(readError),
    };

    const { error: updateError } = await client
      .from("follow_up_queue")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", receiptId);
    const { data: afterUpdate } = await admin
      .from("follow_up_queue")
      .select("id,status,sent_at")
      .eq("id", receiptId)
      .maybeSingle();
    const updateBlocked = afterUpdate?.id === receiptId && afterUpdate?.status === "pending" && !afterUpdate?.sent_at;
    report.probes.receiptUpdateBlocked = {
      pass: updateBlocked,
      clientError: errorSummary(updateError),
      authoritativeStatus: afterUpdate?.status || null,
    };

    const { error: deleteError } = await client
      .from("follow_up_queue")
      .delete()
      .eq("id", receiptId);
    const { data: afterDelete } = await admin
      .from("follow_up_queue")
      .select("id")
      .eq("id", receiptId)
      .maybeSingle();
    const deleteBlocked = afterDelete?.id === receiptId;
    report.probes.receiptDeleteBlocked = {
      pass: deleteBlocked,
      clientError: errorSummary(deleteError),
    };

    const { data: forged, error: forgedError } = await client
      .from("follow_up_queue")
      .insert({
        created_by_id: userId,
        user_id: userId,
        customer_name: "Forged Autopilot Probe",
        customer_email: `forged-${suffix}@titanos.invalid`,
        rule_id: `autopilot_run:forged:${suffix}`,
        scheduled_for: new Date().toISOString(),
        status: "pending",
        channel: "email",
        message: "This row must never be accepted from the authenticated client.",
      })
      .select("id")
      .maybeSingle();
    const forgedBlocked = Boolean(forgedError) || !forged?.id;
    if (forged?.id) await admin.from("follow_up_queue").delete().eq("id", forged.id);
    report.probes.autopilotInsertBlocked = {
      pass: forgedBlocked,
      clientError: errorSummary(forgedError),
    };

    const { data: manual, error: manualError } = await client
      .from("follow_up_queue")
      .insert({
        created_by_id: userId,
        user_id: userId,
        customer_name: "Manual Follow-up Probe",
        rule_id: `security_probe_manual:${suffix}`,
        scheduled_for: new Date().toISOString(),
        status: "pending",
        channel: "in_app",
        message: "Manual follow-up policy compatibility probe.",
      })
      .select("id,status")
      .maybeSingle();
    manualId = manual?.id || null;

    let manualWritable = !manualError && Boolean(manualId);
    let manualUpdateError = null;
    if (manualId) {
      const result = await client
        .from("follow_up_queue")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", manualId);
      manualUpdateError = result.error;
      const { data: manualCheck } = await admin
        .from("follow_up_queue")
        .select("status")
        .eq("id", manualId)
        .maybeSingle();
      manualWritable = manualWritable && !manualUpdateError && manualCheck?.status === "sent";
    }
    report.probes.manualFollowUpStillWritable = {
      pass: manualWritable,
      insertError: errorSummary(manualError),
      updateError: errorSummary(manualUpdateError),
    };

    const { data: telemetryWrite, error: telemetryError } = await client
      .from("autopilot_funnel_events")
      .insert({
        user_id: userId,
        event_name: "signed_in_view",
        source: "direct",
        mode: "membership",
      })
      .select("id")
      .maybeSingle();
    const telemetryBlocked = Boolean(telemetryError) || !telemetryWrite?.id;
    if (telemetryWrite?.id) await admin.from("autopilot_funnel_events").delete().eq("id", telemetryWrite.id);
    report.probes.telemetryClientWriteBlocked = {
      pass: telemetryBlocked,
      clientError: errorSummary(telemetryError),
    };

    const required = [
      receiptReadable,
      updateBlocked,
      deleteBlocked,
      forgedBlocked,
      manualWritable,
      telemetryBlocked,
    ];
    report.ok = required.every(Boolean);
    report.conclusion = report.ok ? "PASS" : "NEEDS_ACTION";
  } finally {
    if (receiptId) await admin.from("follow_up_queue").delete().eq("id", receiptId);
    if (manualId) await admin.from("follow_up_queue").delete().eq("id", manualId);
    if (userId) {
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 3);
}

main().catch((error) => {
  console.log(JSON.stringify({ ok: false, error: error?.message || String(error) }, null, 2));
  process.exit(1);
});
