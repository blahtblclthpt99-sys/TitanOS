import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { readJson } from "../_lib/supabase.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { logError } from "../_lib/safeLog.js";
import { classifyAutopilotSource, recordAutopilotFunnel } from "../_lib/autopilotFunnel.js";
import {
  autopilotQueueOutcome,
  canRetryAutopilotPending,
  deliverAutopilotQueue,
  failAutopilotPending,
  readAutopilotQueue,
} from "../_lib/autopilotDelivery.js";

const MAX_INVOICES = 10;
const STALE_RUN_MS = 15 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RUN_SELECT = "id,user_id,status,updated_at,invoice_ids,recipient_snapshot,prepared_count,sent_count,failed_count,skipped_count,pending_count";

function recipientKey(value) {
  const email = typeof value === "string" ? value : value?.customer_email;
  return String(email || "").trim().toLowerCase();
}

function invoiceIdsFrom(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).map((id) => id.trim()).filter(Boolean))].slice(0, MAX_INVOICES);
}

function hasDuplicateRecipients(invoices) {
  const recipients = (invoices || []).map(recipientKey).filter(Boolean);
  return new Set(recipients).size !== recipients.length;
}

function buildRecipientSnapshot(invoiceIds, invoices) {
  const invoiceById = new Map((invoices || []).map((invoice) => [String(invoice.id), invoice]));
  const snapshot = [];
  for (const invoiceId of invoiceIds) {
    const invoice = invoiceById.get(String(invoiceId));
    const email = recipientKey(invoice);
    if (!invoice || !email) return null;
    snapshot.push({ invoice_id: String(invoiceId), customer_email: email });
  }
  return snapshot;
}

function approvedRecipientMap(invoiceIds, snapshot) {
  const ids = invoiceIdsFrom(invoiceIds);
  const rows = Array.isArray(snapshot) ? snapshot : [];
  if (!ids.length || rows.length !== ids.length) return null;
  const allowed = new Set(ids);
  const approved = new Map();
  for (const row of rows) {
    const id = String(row?.invoice_id || "");
    const email = recipientKey(row?.customer_email || "");
    if (!id || !allowed.has(id) || !email || approved.has(id)) return null;
    approved.set(id, email);
  }
  return approved.size === ids.length ? approved : null;
}

function isStillEligible(invoice, today) {
  return Boolean(
    invoice?.customer_email &&
    invoice.status !== "paid" &&
    invoice.due_date &&
    invoice.due_date < today &&
    Number(invoice.balance_due ?? invoice.total) > 0
  );
}

function isFreshRunning(run) {
  if (run?.status !== "running" || !run.updated_at) return false;
  const updated = new Date(run.updated_at).getTime();
  return Number.isFinite(updated) && Date.now() - updated < STALE_RUN_MS;
}

function reminderMessage(invoice) {
  const balance = Number(invoice.balance_due ?? invoice.total ?? 0).toFixed(2);
  return `Hi ${invoice.customer_name || "there"},\n\nThis is a friendly reminder that invoice ${invoice.invoice_number || invoice.id} for $${balance} was due ${invoice.due_date}. Please contact us if you have already paid or need help with payment.\n\nThank you.`;
}

async function insertSkippedReceipt(admin, ownerId, { customerName = "", email, deliveryKey, code, message }) {
  const { error } = await admin.from("follow_up_queue").insert({
    created_by_id: ownerId,
    user_id: ownerId,
    customer_name: customerName,
    customer_email: email,
    scheduled_for: new Date().toISOString(),
    status: "skipped",
    channel: "email",
    message,
    rule_id: deliveryKey,
    delivery_error_code: code,
  });
  if (error?.code !== "23505") {
    if (error) throw error;
    return "skipped";
  }
  const current = await readAutopilotQueue(admin, { ownerId, deliveryKey });
  return autopilotQueueOutcome(current);
}

async function claimInvoiceDelivery(admin, ownerId, invoiceId, runId, deliveryKey) {
  const { data, error } = await admin.rpc("claim_autopilot_invoice_delivery", {
    p_user_id: ownerId,
    p_invoice_id: invoiceId,
    p_run_id: runId,
    p_delivery_key: deliveryKey,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.claimed !== "boolean") {
    throw new Error("Autopilot delivery guard returned an invalid claim response");
  }
  return row;
}

async function releaseInvoiceDelivery(admin, ownerId, invoiceId, runId, deliveryKey) {
  try {
    const { error } = await admin.rpc("release_autopilot_invoice_delivery", {
      p_user_id: ownerId,
      p_invoice_id: invoiceId,
      p_run_id: runId,
      p_delivery_key: deliveryKey,
    });
    if (error) throw error;
  } catch (error) {
    // Once a pending Recovery Receipt exists, it is the authoritative long-lived
    // concurrency guard. A stale short reservation expires after five minutes.
    logError("runAutopilotFree:guard_release", error, { runId, invoiceId });
  }
}

async function readRun(admin, ownerId, runId) {
  const { data, error } = await admin
    .from("autopilot_runs")
    .select(RUN_SELECT)
    .eq("id", runId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function acquireRun(admin, ownerId, requestedInvoiceIds, requestedSnapshot, requestedRunId) {
  if (requestedRunId) {
    const existing = await readRun(admin, ownerId, requestedRunId);
    if (!existing) return { error: "Recovery sprint not found", status: 404 };
    if (existing.status === "completed") return { duplicate: existing };
    if (isFreshRunning(existing)) return { error: "This recovery sprint is already running", status: 409 };

    const originalInvoiceIds = invoiceIdsFrom(existing.invoice_ids);
    if (!originalInvoiceIds.length || !approvedRecipientMap(originalInvoiceIds, existing.recipient_snapshot)) {
      return {
        error: "The original approved recovery recipients are unavailable. Titan will not infer replacements.",
        code: "AUTOPILOT_RECIPIENT_SNAPSHOT_REQUIRED",
        status: 409,
      };
    }

    const requestedLease = new Date().toISOString();
    const { data: reclaimed, error } = await admin
      .from("autopilot_runs")
      .update({
        status: "running",
        prepared_count: 0,
        sent_count: 0,
        failed_count: 0,
        skipped_count: 0,
        pending_count: 0,
        updated_at: requestedLease,
        completed_at: null,
      })
      .eq("id", existing.id)
      .eq("user_id", ownerId)
      .eq("status", existing.status)
      .eq("updated_at", existing.updated_at)
      .select(RUN_SELECT)
      .maybeSingle();
    if (error) throw error;
    if (!reclaimed) return { error: "This recovery sprint changed while retrying. Try again.", status: 409 };
    return {
      run: reclaimed,
      lease: reclaimed.updated_at || requestedLease,
      invoiceIds: originalInvoiceIds,
      snapshot: existing.recipient_snapshot,
      recovered: true,
    };
  }

  if (!requestedInvoiceIds.length || !approvedRecipientMap(requestedInvoiceIds, requestedSnapshot)) {
    return { error: "Select at least one overdue invoice with an approved customer email", status: 400 };
  }
  const requestedLease = new Date().toISOString();
  const { data: created, error } = await admin
    .from("autopilot_runs")
    .insert({
      user_id: ownerId,
      status: "running",
      invoice_ids: requestedInvoiceIds,
      recipient_snapshot: requestedSnapshot,
      updated_at: requestedLease,
    })
    .select(RUN_SELECT)
    .single();
  if (error) throw error;
  return {
    run: created,
    lease: created.updated_at || requestedLease,
    invoiceIds: requestedInvoiceIds,
    snapshot: requestedSnapshot,
    recovered: false,
  };
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!(await assertRateLimitAsync(req, res, {
    limit: 6,
    windowMs: 60_000,
    key: "runAutopilotFree",
    requireDurable: true,
    durableUnavailableStatus: 424,
  }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  const resendKey = String(process.env.RESEND_API_KEY || "").trim();
  if (!resendKey) {
    return res.status(503).json({
      error: "Autopilot email delivery is not configured yet.",
      code: "AUTOPILOT_DELIVERY_NOT_CONFIGURED",
    });
  }

  const source = classifyAutopilotSource(req);
  let run = null;
  let lease = "";
  let funnelInvoiceCount = 0;

  try {
    const body = readJson(req);
    const requestedRunId = String(body.run_id || "").trim();
    if (requestedRunId && !UUID_RE.test(requestedRunId)) {
      return res.status(400).json({ error: "Invalid recovery sprint ID" });
    }

    const requestedInvoiceIds = requestedRunId ? [] : invoiceIdsFrom(body.invoice_ids);
    if (!requestedRunId && requestedInvoiceIds.some((id) => !UUID_RE.test(id))) {
      return res.status(400).json({ error: "One or more invoice IDs are invalid" });
    }
    const today = new Date().toISOString().slice(0, 10);
    let requestedSnapshot = null;

    if (!requestedRunId) {
      if (!requestedInvoiceIds.length) return res.status(400).json({ error: "Select at least one overdue invoice" });
      const { data: requestedInvoices, error } = await auth.admin
        .from("invoices")
        .select("id,invoice_number,customer_name,customer_email,status,balance_due,total,due_date,created_by_id")
        .in("id", requestedInvoiceIds)
        .eq("created_by_id", auth.user.id);
      if (error) throw error;
      if ((requestedInvoices || []).length !== requestedInvoiceIds.length) {
        return res.status(400).json({ error: "Every selected invoice must belong to your account" });
      }
      const byId = new Map((requestedInvoices || []).map((invoice) => [String(invoice.id), invoice]));
      const ordered = requestedInvoiceIds.map((id) => byId.get(id)).filter(Boolean);
      if (ordered.length !== requestedInvoiceIds.length || !ordered.every((invoice) => isStillEligible(invoice, today))) {
        return res.status(400).json({ error: "Every selection must be overdue, unpaid, and have a customer email" });
      }
      if (hasDuplicateRecipients(ordered)) {
        return res.status(400).json({ error: "Select only one overdue invoice per customer email in each recovery sprint" });
      }
      requestedSnapshot = buildRecipientSnapshot(requestedInvoiceIds, ordered);
      if (!requestedSnapshot) return res.status(400).json({ error: "The approved recipient list could not be created safely" });
    }

    const acquired = await acquireRun(
      auth.admin,
      auth.user.id,
      requestedInvoiceIds,
      requestedSnapshot,
      requestedRunId
    );
    if (acquired.error) {
      return res.status(acquired.status || 409).json({ error: acquired.error, code: acquired.code });
    }
    if (acquired.duplicate) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        run_id: acquired.duplicate.id,
        retryable: false,
        prepared: acquired.duplicate.prepared_count || 0,
        sent: acquired.duplicate.sent_count || 0,
        failed: acquired.duplicate.failed_count || 0,
        skipped: acquired.duplicate.skipped_count || 0,
        pending: acquired.duplicate.pending_count || 0,
      });
    }

    run = acquired.run;
    lease = acquired.lease;
    const effectiveInvoiceIds = invoiceIdsFrom(acquired.invoiceIds);
    const approvedRecipients = approvedRecipientMap(effectiveInvoiceIds, acquired.snapshot || run.recipient_snapshot);
    if (!effectiveInvoiceIds.length || !approvedRecipients) {
      throw new Error("Autopilot free run lost its approved recipient snapshot");
    }

    funnelInvoiceCount = effectiveInvoiceIds.length;
    await recordAutopilotFunnel(auth.admin, {
      userId: auth.user.id,
      eventName: "free_run_started",
      source,
      mode: "free",
      invoiceCount: funnelInvoiceCount,
      outcome: "pending",
    });

    const { data: currentInvoices, error: currentError } = await auth.admin
      .from("invoices")
      .select("id,invoice_number,customer_name,customer_email,status,balance_due,total,due_date,created_by_id")
      .in("id", effectiveInvoiceIds)
      .eq("created_by_id", auth.user.id);
    if (currentError) throw currentError;
    const currentById = new Map((currentInvoices || []).map((invoice) => [String(invoice.id), invoice]));

    let prepared = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let pending = 0;

    const count = (outcome) => {
      if (outcome === "skipped") { skipped += 1; return; }
      prepared += 1;
      if (outcome === "sent") sent += 1;
      else if (outcome === "failed") failed += 1;
      else pending += 1;
    };

    for (const invoiceId of effectiveInvoiceIds) {
      const approvedEmail = approvedRecipients.get(invoiceId);
      const deliveryKey = `autopilot_run:free:${run.id}:${invoiceId}`;
      const prior = await readAutopilotQueue(auth.admin, { ownerId: auth.user.id, deliveryKey });

      if (prior) {
        const priorOutcome = autopilotQueueOutcome(prior);
        if (priorOutcome !== "pending") { count(priorOutcome); continue; }
        if (recipientKey(prior.customer_email) !== approvedEmail) {
          const reconciled = await failAutopilotPending(auth.admin, prior.id, "approved_recipient_mismatch");
          count(autopilotQueueOutcome(reconciled));
          continue;
        }

        const { data: fresh, error } = await auth.admin
          .from("invoices")
          .select("id,customer_email,status,balance_due,total,due_date,created_by_id")
          .eq("id", invoiceId)
          .eq("created_by_id", auth.user.id)
          .maybeSingle();
        if (error) throw error;
        const recipientChanged = recipientKey(fresh) !== approvedEmail;
        if (!isStillEligible(fresh, today) || recipientChanged) {
          const reconciled = await failAutopilotPending(
            auth.admin,
            prior.id,
            recipientChanged ? "approved_recipient_changed" : "delivery_unconfirmed_invoice_no_longer_eligible"
          );
          count(autopilotQueueOutcome(reconciled));
          continue;
        }
        if (!canRetryAutopilotPending(prior)) {
          const reconciled = await failAutopilotPending(auth.admin, prior.id, "provider_idempotency_window_expired");
          count(autopilotQueueOutcome(reconciled));
          continue;
        }
        const result = await deliverAutopilotQueue({
          admin: auth.admin,
          queue: prior,
          resendKey,
          deliveryKey,
          route: "runAutopilotFree",
          context: { runId: run.id, invoiceId },
        });
        count(result.outcome);
        continue;
      }

      const invoice = currentById.get(invoiceId) || null;
      if (!invoice) {
        const outcome = await insertSkippedReceipt(auth.admin, auth.user.id, {
          email: approvedEmail,
          deliveryKey,
          code: "invoice_missing_after_approval",
          message: `Skipped invoice ${invoiceId}: it is no longer available for this approved recovery sprint.`,
        });
        count(outcome);
        continue;
      }

      const { data: fresh, error } = await auth.admin
        .from("invoices")
        .select("id,invoice_number,customer_name,customer_email,status,balance_due,total,due_date,created_by_id")
        .eq("id", invoiceId)
        .eq("created_by_id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      const recipientChanged = recipientKey(fresh) !== approvedEmail;
      if (!isStillEligible(fresh, today) || recipientChanged) {
        const outcome = await insertSkippedReceipt(auth.admin, auth.user.id, {
          customerName: invoice.customer_name || "",
          email: approvedEmail,
          deliveryKey,
          code: recipientChanged ? "approved_recipient_changed" : "invoice_no_longer_eligible",
          message: recipientChanged
            ? `Skipped invoice ${invoice.invoice_number || invoiceId}: the customer email changed after approval and requires a new recovery approval.`
            : `Skipped invoice ${invoice.invoice_number || invoiceId}: it is no longer an eligible overdue balance.`,
        });
        count(outcome);
        continue;
      }

      const claim = await claimInvoiceDelivery(auth.admin, auth.user.id, invoiceId, run.id, deliveryKey);
      if (!claim.claimed) {
        const recent = claim.reason === "recent_sent";
        const code = recent ? "recent_autopilot_reminder" : "autopilot_delivery_in_progress";
        const message = recent
          ? `Skipped invoice ${fresh.invoice_number || invoiceId}: Titan already sent a reminder for this invoice within the 72-hour safety window.`
          : `Skipped invoice ${fresh.invoice_number || invoiceId}: another Autopilot delivery for this invoice is already in progress. Retry after the existing delivery is reconciled.`;
        const outcome = await insertSkippedReceipt(auth.admin, auth.user.id, {
          customerName: fresh.customer_name || invoice.customer_name || "",
          email: approvedEmail,
          deliveryKey,
          code,
          message,
        });
        count(outcome);
        continue;
      }

      const message = reminderMessage(fresh);
      const { data: queue, error: queueError } = await auth.admin
        .from("follow_up_queue")
        .insert({
          created_by_id: auth.user.id,
          user_id: auth.user.id,
          customer_name: fresh.customer_name || "",
          customer_email: approvedEmail,
          scheduled_for: new Date().toISOString(),
          status: "pending",
          channel: "email",
          message,
          rule_id: deliveryKey,
        })
        .select("id,status,created_at,customer_email,message")
        .single();

      if (queueError?.code === "23505") {
        const current = await readAutopilotQueue(auth.admin, { ownerId: auth.user.id, deliveryKey });
        await releaseInvoiceDelivery(auth.admin, auth.user.id, invoiceId, run.id, deliveryKey);
        count(autopilotQueueOutcome(current));
        continue;
      }
      if (queueError) {
        await releaseInvoiceDelivery(auth.admin, auth.user.id, invoiceId, run.id, deliveryKey);
        throw queueError;
      }

      // The persisted pending Receipt now protects this invoice for the provider
      // retry window, so the short pre-queue reservation can be released.
      await releaseInvoiceDelivery(auth.admin, auth.user.id, invoiceId, run.id, deliveryKey);

      const result = await deliverAutopilotQueue({
        admin: auth.admin,
        queue,
        resendKey,
        deliveryKey,
        route: "runAutopilotFree",
        context: { runId: run.id, invoiceId },
      });
      count(result.outcome);
    }

    const retryable = pending > 0;
    const finalStatus = retryable ? "retryable" : failed > 0 ? "failed" : "completed";
    const finishedAt = new Date().toISOString();
    const { data: finalized, error: finalizeError } = await auth.admin
      .from("autopilot_runs")
      .update({
        status: finalStatus,
        prepared_count: prepared,
        sent_count: sent,
        failed_count: failed,
        skipped_count: skipped,
        pending_count: pending,
        updated_at: finishedAt,
        completed_at: retryable ? null : finishedAt,
      })
      .eq("id", run.id)
      .eq("user_id", auth.user.id)
      .eq("status", "running")
      .eq("updated_at", lease)
      .select("id,status")
      .maybeSingle();
    if (finalizeError) throw finalizeError;
    if (!finalized) return res.status(409).json({ error: "This recovery sprint lease changed while finishing. Retry to reconcile receipts." });

    await recordAutopilotFunnel(auth.admin, {
      userId: auth.user.id,
      eventName: retryable ? "run_retryable" : failed > 0 ? "run_failed" : "run_completed",
      source,
      mode: "free",
      invoiceCount: funnelInvoiceCount,
      outcome: retryable ? "retryable" : failed > 0 ? "failed" : "completed",
    });

    return res.status(retryable ? 202 : 200).json({
      success: finalStatus === "completed",
      retryable,
      run_id: run.id,
      prepared,
      sent,
      failed,
      skipped,
      pending,
      delivery_mode: "email",
      receipts_url: "/follow-ups",
    });
  } catch (error) {
    logError("runAutopilotFree", error, { runId: run?.id || null });
    if (run?.id && lease) {
      try {
        await auth.admin
          .from("autopilot_runs")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", run.id)
          .eq("user_id", auth.user.id)
          .eq("status", "running")
          .eq("updated_at", lease);
      } catch {
        // Recovery Receipts remain authoritative even if run-state cleanup fails.
      }
    }
    await recordAutopilotFunnel(auth.admin, {
      userId: auth.user.id,
      eventName: "run_failed",
      source,
      mode: "free",
      invoiceCount: funnelInvoiceCount,
      outcome: "failed",
    });
    return res.status(500).json({ error: "Autopilot recovery sprint could not finish safely. Retry to reconcile existing receipts." });
  }
}
