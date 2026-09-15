import { existsSync, readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
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

const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
const token = () => randomBytes(6).toString("hex");
const errorSummary = (error) => error ? { code: error.code || null, message: error.message || String(error) } : null;

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
  let invoiceId = null;
  let receiptId = null;
  let manualId = null;
  let freeRunId = null;
  let guardDeliveryKey = null;

  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (createError || !created?.user?.id) throw createError || new Error("probe_user_not_created");
    userId = created.user.id;

    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;

    const { data: invoice, error: invoiceError } = await admin
      .from("invoices")
      .insert({
        created_by_id: userId,
        invoice_number: `SECURITY-${suffix}`,
        customer_name: "Autopilot Security Probe",
        status: "sent",
        total: 1,
        balance_due: 1,
        due_date: "2026-01-01",
      })
      .select("id")
      .single();
    if (invoiceError || !invoice?.id) throw invoiceError || new Error("probe_invoice_not_created");
    invoiceId = invoice.id;

    const { data: freeRun, error: freeRunError } = await admin
      .from("autopilot_runs")
      .insert({
        user_id: userId,
        status: "running",
        invoice_ids: [invoiceId],
        recipient_snapshot: [{ invoice_id: invoiceId, customer_email: `recipient-${suffix}@titanos.invalid` }],
      })
      .select("id,status")
      .single();
    freeRunId = freeRun?.id || null;
    const freeRunServiceWritable = !freeRunError && Boolean(freeRunId);
    report.probes.freeRunServiceWritable = { pass: freeRunServiceWritable, error: errorSummary(freeRunError) };

    let freeRunClientBlocked = false;
    let freeRunClientError = null;
    if (freeRunId) {
      const attempt = await client.from("autopilot_runs").update({ status: "completed" }).eq("id", freeRunId);
      freeRunClientError = attempt.error;
      const { data: authoritative } = await admin.from("autopilot_runs").select("status").eq("id", freeRunId).maybeSingle();
      freeRunClientBlocked = authoritative?.status === "running";
    }
    report.probes.freeRunClientWriteBlocked = { pass: freeRunClientBlocked, clientError: errorSummary(freeRunClientError) };

    guardDeliveryKey = `autopilot_run:free:${freeRunId}:${invoiceId}`;
    const { data: serviceClaimRows, error: serviceClaimError } = await admin.rpc("claim_autopilot_invoice_delivery", {
      p_user_id: userId,
      p_invoice_id: invoiceId,
      p_run_id: freeRunId,
      p_delivery_key: guardDeliveryKey,
    });
    const serviceClaim = Array.isArray(serviceClaimRows) ? serviceClaimRows[0] : serviceClaimRows;
    const guardServiceWritable = !serviceClaimError && serviceClaim?.claimed === true;
    report.probes.guardServiceClaimWorks = { pass: guardServiceWritable, error: errorSummary(serviceClaimError) };

    const { data: guardVisible, error: guardReadError } = await client
      .from("autopilot_invoice_delivery_guards")
      .select("user_id,invoice_id")
      .eq("user_id", userId)
      .eq("invoice_id", invoiceId)
      .maybeSingle();
    const guardClientReadBlocked = Boolean(guardReadError) || !guardVisible;
    report.probes.guardClientReadBlocked = { pass: guardClientReadBlocked, clientError: errorSummary(guardReadError) };

    const { data: clientClaimRows, error: clientClaimError } = await client.rpc("claim_autopilot_invoice_delivery", {
      p_user_id: userId,
      p_invoice_id: invoiceId,
      p_run_id: randomUUID(),
      p_delivery_key: `autopilot_run:free:${randomUUID()}:${invoiceId}`,
    });
    const guardClientRpcBlocked = Boolean(clientClaimError) && !clientClaimRows;
    report.probes.guardClientRpcBlocked = { pass: guardClientRpcBlocked, clientError: errorSummary(clientClaimError) };

    const { data: secondClaimRows, error: secondClaimError } = await admin.rpc("claim_autopilot_invoice_delivery", {
      p_user_id: userId,
      p_invoice_id: invoiceId,
      p_run_id: randomUUID(),
      p_delivery_key: `autopilot_run:free:${randomUUID()}:${invoiceId}`,
    });
    const secondClaim = Array.isArray(secondClaimRows) ? secondClaimRows[0] : secondClaimRows;
    const guardSerializes = !secondClaimError && secondClaim?.claimed === false && secondClaim?.reason === "active_reservation";
    report.probes.guardSerializesNewRuns = { pass: guardSerializes, error: errorSummary(secondClaimError), reason: secondClaim?.reason || null };

    if (guardServiceWritable) {
      const { data: released, error: releaseError } = await admin.rpc("release_autopilot_invoice_delivery", {
        p_user_id: userId,
        p_invoice_id: invoiceId,
        p_run_id: freeRunId,
        p_delivery_key: guardDeliveryKey,
      });
      report.probes.guardServiceReleaseWorks = { pass: !releaseError && released === true, error: errorSummary(releaseError) };
    } else {
      report.probes.guardServiceReleaseWorks = { pass: false, error: { message: "claim_not_acquired" } };
    }

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
      .from("follow_up_queue").select("id,status,rule_id").eq("id", receiptId).maybeSingle();
    const receiptReadable = !readError && readable?.id === receiptId && readable?.rule_id === deliveryKey;
    report.probes.receiptReadable = { pass: receiptReadable, error: errorSummary(readError) };

    const { error: updateError } = await client
      .from("follow_up_queue").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", receiptId);
    const { data: afterUpdate } = await admin
      .from("follow_up_queue").select("id,status,sent_at").eq("id", receiptId).maybeSingle();
    const updateBlocked = afterUpdate?.id === receiptId && afterUpdate?.status === "pending" && !afterUpdate?.sent_at;
    report.probes.receiptUpdateBlocked = { pass: updateBlocked, clientError: errorSummary(updateError) };

    const { error: deleteError } = await client.from("follow_up_queue").delete().eq("id", receiptId);
    const { data: afterDelete } = await admin.from("follow_up_queue").select("id").eq("id", receiptId).maybeSingle();
    const deleteBlocked = afterDelete?.id === receiptId;
    report.probes.receiptDeleteBlocked = { pass: deleteBlocked, clientError: errorSummary(deleteError) };

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
    report.probes.autopilotInsertBlocked = { pass: forgedBlocked, clientError: errorSummary(forgedError) };

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
      const result = await client.from("follow_up_queue").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", manualId);
      manualUpdateError = result.error;
      const { data: manualCheck } = await admin.from("follow_up_queue").select("status").eq("id", manualId).maybeSingle();
      manualWritable = manualWritable && !manualUpdateError && manualCheck?.status === "sent";
    }
    report.probes.manualFollowUpStillWritable = { pass: manualWritable, insertError: errorSummary(manualError), updateError: errorSummary(manualUpdateError) };

    const { error: telemetrySchemaError } = await admin.from("autopilot_funnel_events").select("id", { head: true, count: "exact" });
    const telemetrySchemaPresent = !telemetrySchemaError;
    report.probes.telemetrySchemaPresent = { pass: telemetrySchemaPresent, error: errorSummary(telemetrySchemaError) };

    const { data: telemetryService, error: telemetryServiceError } = await admin
      .from("autopilot_funnel_events")
      .insert({ user_id: userId, event_name: "free_run_started", source: "direct", mode: "free", invoice_count: 1, outcome: "pending" })
      .select("id")
      .single();
    const freeTelemetryWritable = !telemetryServiceError && Boolean(telemetryService?.id);
    if (telemetryService?.id) await admin.from("autopilot_funnel_events").delete().eq("id", telemetryService.id);
    report.probes.freeTelemetryWritable = { pass: freeTelemetryWritable, error: errorSummary(telemetryServiceError) };

    const { data: telemetryWrite, error: telemetryError } = await client
      .from("autopilot_funnel_events")
      .insert({ user_id: userId, event_name: "free_run_started", source: "direct", mode: "free" })
      .select("id")
      .maybeSingle();
    const telemetryBlocked = telemetrySchemaPresent && (Boolean(telemetryError) || !telemetryWrite?.id);
    if (telemetryWrite?.id) await admin.from("autopilot_funnel_events").delete().eq("id", telemetryWrite.id);
    report.probes.telemetryClientWriteBlocked = { pass: telemetryBlocked, clientError: errorSummary(telemetryError) };

    const required = [
      freeRunServiceWritable,
      freeRunClientBlocked,
      guardServiceWritable,
      guardClientReadBlocked,
      guardClientRpcBlocked,
      guardSerializes,
      report.probes.guardServiceReleaseWorks.pass,
      receiptReadable,
      updateBlocked,
      deleteBlocked,
      forgedBlocked,
      manualWritable,
      telemetrySchemaPresent,
      freeTelemetryWritable,
      telemetryBlocked,
    ];
    report.ok = required.every(Boolean);
    report.conclusion = report.ok ? "PASS" : "NEEDS_ACTION";
  } finally {
    if (receiptId) await admin.from("follow_up_queue").delete().eq("id", receiptId);
    if (manualId) await admin.from("follow_up_queue").delete().eq("id", manualId);
    if (userId) await admin.from("autopilot_invoice_delivery_guards").delete().eq("user_id", userId);
    if (freeRunId) await admin.from("autopilot_runs").delete().eq("id", freeRunId);
    if (invoiceId) await admin.from("invoices").delete().eq("id", invoiceId);
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
