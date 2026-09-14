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
const periodKey = () => `${new Date().toISOString().slice(0, 7)}-01`;

function recipientKey(emailOrInvoice) {
  const email = typeof emailOrInvoice === "string" ? emailOrInvoice : emailOrInvoice?.customer_email;
  return String(email || "").trim().toLowerCase();
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
  const ids = (invoiceIds || []).map(String).filter(Boolean);
  const rows = Array.isArray(snapshot) ? snapshot : [];
  if (!ids.length || rows.length !== ids.length) return null;

  const allowedIds = new Set(ids);
  const map = new Map();
  for (const row of rows) {
    const invoiceId = String(row?.invoice_id || "");
    const email = recipientKey(row?.customer_email || "");
    if (!invoiceId || !allowedIds.has(invoiceId) || !email || map.has(invoiceId)) return null;
    map.set(invoiceId, email);
  }
  return map.size === ids.length ? map : null;
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

function isFreshRun(claim) {
  if (claim?.status !== "running" || !claim.updated_at) return false;
  const updated = new Date(claim.updated_at).getTime();
  return Number.isFinite(updated) && Date.now() - updated < STALE_RUN_MS;
}

async function readMonthlyClaim(admin, userId, period = periodKey()) {
  const { data, error } = await admin
    .from("autopilot_membership_claims")
    .select("id,status,updated_at,invoice_ids,recipient_snapshot,prepared_count,sent_count,failed_count")
    .eq("user_id", userId)
    .eq("period_key", period)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function acquireMonthlyClaim(
  admin,
  userId,
  requestedInvoiceIds,
  requestedRecipientSnapshot,
  existingClaim = null
) {
  const period = periodKey();
  const existing = existingClaim || await readMonthlyClaim(admin, userId, period);

  if (existing?.status === "completed") {
    return { conflict: "This month's included recovery sprint has already been used." };
  }
  if (existing && isFreshRun(existing)) {
    return { conflict: "This month's recovery sprint is already running." };
  }

  if (existing) {
    const originalInvoiceIds = Array.isArray(existing.invoice_ids)
      ? existing.invoice_ids.map(String).filter(Boolean)
      : [];
    const originalRecipients = approvedRecipientMap(originalInvoiceIds, existing.recipient_snapshot);
    if (!originalInvoiceIds.length || !originalRecipients) {
      return {
        conflict: "This month's recovery sprint cannot be safely recovered because its exact original approved recipients are unavailable. Start a new sprint next billing period.",
      };
    }

    const updatedAt = new Date().toISOString();
    const { data: reclaimed, error: reclaimError } = await admin
      .from("autopilot_membership_claims")
      .update({
        invoice_ids: originalInvoiceIds,
        recipient_snapshot: existing.recipient_snapshot,
        status: "running",
        prepared_count: 0,
        sent_count: 0,
        failed_count: 0,
        updated_at: updatedAt,
      })
      .eq("id", existing.id)
      .eq("status", existing.status)
      .eq("updated_at", existing.updated_at)
      .select("id,status,updated_at,invoice_ids,recipient_snapshot")
      .maybeSingle();
    if (reclaimError) throw reclaimError;
    if (!reclaimed) return { conflict: "This month's recovery sprint changed while it was starting. Try again." };
    return {
      claim: reclaimed,
      period,
      recovered: true,
      invoiceIds: originalInvoiceIds,
      recipientSnapshot: existing.recipient_snapshot,
    };
  }

  if (!requestedInvoiceIds.length || !approvedRecipientMap(requestedInvoiceIds, requestedRecipientSnapshot)) {
    return { conflict: "Select at least one overdue invoice with an approved customer email." };
  }

  const { data: claim, error: claimError } = await admin
    .from("autopilot_membership_claims")
    .insert({
      user_id: userId,
      period_key: period,
      invoice_ids: requestedInvoiceIds,
      recipient_snapshot: requestedRecipientSnapshot,
      status: "running",
    })
    .select("id,status,updated_at,invoice_ids,recipient_snapshot")
    .single();
  if (claimError?.code === "23505") {
    return { conflict: "This month's included recovery sprint has already been claimed." };
  }
  if (claimError) throw claimError;
  return {
    claim,
    period,
    recovered: false,
    invoiceIds: requestedInvoiceIds,
    recipientSnapshot: requestedRecipientSnapshot,
  };
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 4, windowMs: 60_000, key: "runAutopilotMembership" }))) return;
  const auth = await requireUser(req, res);
  if (!auth) return;

  let executionClaimed = false;
  let funnelInvoiceCount = 0;
  const funnelSource = classifyAutopilotSource(req);

  try {
    const { data: profile } = await auth.admin
      .from("profiles")
      .select("plan_tier,paying_subscriber,role")
      .eq("id", auth.user.id)
      .maybeSingle();
    const plan = String(profile?.plan_tier || "").toLowerCase();
    const entitled = profile?.role === "admin" || (profile?.paying_subscriber === true && ["worker_premium", "pro", "business"].includes(plan));
    if (!entitled) return res.status(402).json({ error: "A paid Pro or Business membership is required." });

    const body = readJson(req);
    const requestedInvoiceIds = [...new Set(Array.isArray(body.invoice_ids) ? body.invoice_ids.map(String) : [])]
      .filter(Boolean)
      .slice(0, MAX_INVOICES);
    const today = new Date().toISOString().slice(0, 10);

    // Recovery always uses both the original approved invoice IDs and the exact
    // approved recipient snapshot. A later UI selection/email edit cannot redirect it.
    const existingClaim = await readMonthlyClaim(auth.admin, auth.user.id);
    if (existingClaim?.status === "completed") {
      return res.status(409).json({ error: "This month's included recovery sprint has already been used." });
    }
    if (existingClaim && isFreshRun(existingClaim)) {
      return res.status(409).json({ error: "This month's recovery sprint is already running." });
    }

    let requestedRecipientSnapshot = null;
    if (!existingClaim) {
      if (!requestedInvoiceIds.length) return res.status(400).json({ error: "Select at least one overdue invoice" });
      const { data: requestedInvoices, error: requestedError } = await auth.admin
        .from("invoices")
        .select("id,invoice_number,customer_name,customer_email,status,balance_due,total,due_date,created_by_id")
        .in("id", requestedInvoiceIds)
        .eq("created_by_id", auth.user.id);
      if (requestedError) throw requestedError;
      if ((requestedInvoices || []).length !== requestedInvoiceIds.length) {
        return res.status(400).json({ error: "Every selected invoice must belong to your account" });
      }

      const requestedById = new Map((requestedInvoices || []).map((invoice) => [String(invoice.id), invoice]));
      const orderedRequestedInvoices = requestedInvoiceIds.map((id) => requestedById.get(String(id))).filter(Boolean);
      if (
        orderedRequestedInvoices.length !== requestedInvoiceIds.length ||
        !orderedRequestedInvoices.every((invoice) => isStillEligible(invoice, today))
      ) {
        return res.status(400).json({ error: "Every selection must be overdue, unpaid, and have a customer email" });
      }
      if (hasDuplicateRecipients(orderedRequestedInvoices)) {
        return res.status(400).json({ error: "Select only one overdue invoice per customer email in each recovery sprint" });
      }
      requestedRecipientSnapshot = buildRecipientSnapshot(requestedInvoiceIds, orderedRequestedInvoices);
      if (!requestedRecipientSnapshot) {
        return res.status(400).json({ error: "The approved recipient list could not be created safely" });
      }
    }

    const acquired = await acquireMonthlyClaim(
      auth.admin,
      auth.user.id,
      requestedInvoiceIds,
      requestedRecipientSnapshot,
      existingClaim
    );
    if (acquired.conflict) return res.status(409).json({ error: acquired.conflict });
    const claim = acquired.claim;
    executionClaimed = true;

    const effectiveInvoiceIds = (acquired.invoiceIds || []).map(String).filter(Boolean);
    const approvedRecipients = approvedRecipientMap(
      effectiveInvoiceIds,
      acquired.recipientSnapshot || claim.recipient_snapshot
    );
    if (!effectiveInvoiceIds.length || !approvedRecipients) {
      return res.status(409).json({
        error: "The original approved monthly recovery recipients are unavailable. Titan will not infer replacement recipients.",
        code: "AUTOPILOT_RECIPIENT_SNAPSHOT_REQUIRED",
      });
    }

    funnelInvoiceCount = Math.min(10, effectiveInvoiceIds.length);
    await recordAutopilotFunnel(auth.admin, {
      userId: auth.user.id,
      eventName: "membership_run_started",
      source: funnelSource,
      mode: "membership",
      invoiceCount: funnelInvoiceCount,
      outcome: "pending",
    });

    const { data: invoices, error: invoiceError } = await auth.admin
      .from("invoices")
      .select("id,invoice_number,customer_name,customer_email,status,balance_due,total,due_date,created_by_id")
      .in("id", effectiveInvoiceIds)
      .eq("created_by_id", auth.user.id);
    if (invoiceError) throw invoiceError;

    const invoiceById = new Map((invoices || []).map((invoice) => [String(invoice.id), invoice]));
    const orderedInvoices = effectiveInvoiceIds.map((id) => invoiceById.get(id)).filter(Boolean);

    const resendKey = process.env.RESEND_API_KEY;
    let prepared = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let pending = 0;

    const countOutcome = (outcome, { addPrepared = true } = {}) => {
      if (outcome === "skipped") {
        skipped += 1;
        return;
      }
      if (addPrepared) prepared += 1;
      if (outcome === "sent") sent += 1;
      else if (outcome === "failed") failed += 1;
      else if (outcome === "pending" && resendKey) pending += 1;
    };

    const reconcileDelivery = async (deliveryKey, context) => {
      const row = await readAutopilotQueue(auth.admin, {
        ownerId: auth.user.id,
        deliveryKey,
      });
      const outcome = autopilotQueueOutcome(row);
      if (outcome === "missing") {
        failed += 1;
        logError(
          "runAutopilotMembership:queue_reconcile_missing",
          new Error("Autopilot queue row was not visible after a uniqueness collision"),
          context
        );
        return null;
      }
      countOutcome(outcome);
      return row;
    };

    const priorByInvoiceId = new Map();
    const reservedRecipients = new Set();
    for (const invoice of orderedInvoices) {
      const invoiceId = String(invoice.id);
      const approvedEmail = approvedRecipients.get(invoiceId);
      const deliveryKey = `autopilot_run:membership:${claim.id}:${invoice.id}`;
      const prior = await readAutopilotQueue(auth.admin, {
        ownerId: auth.user.id,
        deliveryKey,
      });
      if (!prior) continue;
      priorByInvoiceId.set(invoiceId, prior);
      if (autopilotQueueOutcome(prior) !== "skipped" && approvedEmail) {
        reservedRecipients.add(approvedEmail);
      }
    }

    for (const invoice of orderedInvoices) {
      const invoiceId = String(invoice.id);
      const approvedEmail = approvedRecipients.get(invoiceId);
      const deliveryKey = `autopilot_run:membership:${claim.id}:${invoice.id}`;
      const prior = priorByInvoiceId.get(invoiceId) || null;

      if (!approvedEmail) {
        throw new Error("Approved monthly Autopilot recipient disappeared from the claim snapshot");
      }

      if (prior) {
        const priorOutcome = autopilotQueueOutcome(prior);
        if (priorOutcome !== "pending") {
          countOutcome(priorOutcome);
          continue;
        }

        if (recipientKey(prior.customer_email) !== approvedEmail) {
          const current = await failAutopilotPending(auth.admin, prior.id, "approved_recipient_mismatch");
          const outcome = autopilotQueueOutcome(current);
          countOutcome(outcome === "missing" ? "pending" : outcome);
          continue;
        }

        if (!resendKey) {
          countOutcome("pending");
          continue;
        }

        const { data: freshForRetry, error: retryReadError } = await auth.admin
          .from("invoices")
          .select("id,customer_email,status,balance_due,total,due_date,created_by_id")
          .eq("id", invoice.id)
          .eq("created_by_id", auth.user.id)
          .maybeSingle();
        if (retryReadError) throw retryReadError;

        const recipientChanged = recipientKey(freshForRetry) !== approvedEmail;
        if (!isStillEligible(freshForRetry, today) || recipientChanged) {
          const code = recipientChanged
            ? "approved_recipient_changed"
            : "delivery_unconfirmed_invoice_no_longer_eligible";
          const current = await failAutopilotPending(auth.admin, prior.id, code);
          const outcome = autopilotQueueOutcome(current);
          countOutcome(outcome === "missing" ? "pending" : outcome);
          logError(
            "runAutopilotMembership:pending_stopped",
            new Error("Pending membership delivery no longer matches the approved recipient/eligibility state"),
            { claimId: claim.id, invoiceId: invoice.id, code, reconciled: outcome }
          );
          continue;
        }

        if (!canRetryAutopilotPending(prior)) {
          const current = await failAutopilotPending(auth.admin, prior.id, "idempotency_window_expired");
          const outcome = autopilotQueueOutcome(current);
          countOutcome(outcome === "missing" ? "pending" : outcome);
          logError(
            "runAutopilotMembership:pending_retry_window_expired",
            new Error("Pending membership delivery exceeded the provider idempotency window"),
            { claimId: claim.id, invoiceId: invoice.id, reconciled: outcome }
          );
          continue;
        }

        const { outcome } = await deliverAutopilotQueue({
          admin: auth.admin,
          queue: prior,
          resendKey,
          deliveryKey,
          route: "runAutopilotMembership",
          context: { claimId: claim.id, invoiceId: invoice.id },
        });
        countOutcome(outcome);
        continue;
      }

      const { data: freshInvoice, error: freshError } = await auth.admin
        .from("invoices")
        .select("id,invoice_number,customer_name,customer_email,status,balance_due,total,due_date,created_by_id")
        .eq("id", invoice.id)
        .eq("created_by_id", auth.user.id)
        .maybeSingle();
      if (freshError) throw freshError;

      const recipientChanged = recipientKey(freshInvoice) !== approvedEmail;
      if (!isStillEligible(freshInvoice, today) || recipientChanged) {
        const message = recipientChanged
          ? `Skipped invoice ${invoice.invoice_number || invoice.id}: the customer email changed after approval and requires a new recovery approval.`
          : `Skipped invoice ${invoice.invoice_number || invoice.id}: it is no longer an eligible overdue balance.`;
        const { error: skipError } = await auth.admin.from("follow_up_queue").insert({
          created_by_id: auth.user.id,
          user_id: auth.user.id,
          customer_name: invoice.customer_name || "",
          customer_email: approvedEmail,
          scheduled_for: new Date().toISOString(),
          status: "skipped",
          channel: "email",
          message,
          rule_id: deliveryKey,
          delivery_error_code: recipientChanged ? "approved_recipient_changed" : null,
        });
        if (skipError?.code === "23505") {
          await reconcileDelivery(deliveryKey, { claimId: claim.id, invoiceId: invoice.id });
        } else if (skipError) {
          throw skipError;
        } else {
          skipped += 1;
        }
        continue;
      }

      if (reservedRecipients.has(approvedEmail)) {
        const duplicateMessage = `Skipped invoice ${freshInvoice.invoice_number || freshInvoice.id}: another approved invoice for this customer is already assigned to this recovery sprint.`;
        const { error: duplicateError } = await auth.admin.from("follow_up_queue").insert({
          created_by_id: auth.user.id,
          user_id: auth.user.id,
          customer_name: freshInvoice.customer_name || "",
          customer_email: approvedEmail,
          scheduled_for: new Date().toISOString(),
          status: "skipped",
          channel: "email",
          message: duplicateMessage,
          rule_id: deliveryKey,
          delivery_error_code: "duplicate_recipient_in_sprint",
        });
        if (duplicateError?.code === "23505") {
          await reconcileDelivery(deliveryKey, { claimId: claim.id, invoiceId: invoice.id });
        } else if (duplicateError) {
          throw duplicateError;
        } else {
          skipped += 1;
        }
        continue;
      }
      reservedRecipients.add(approvedEmail);

      const balance = Number(freshInvoice.balance_due ?? freshInvoice.total ?? 0).toFixed(2);
      const message = `Hi ${freshInvoice.customer_name || "there"},\n\nThis is a friendly reminder that invoice ${freshInvoice.invoice_number || freshInvoice.id} for $${balance} was due ${freshInvoice.due_date}. Please contact us if you have already paid or need help with payment.\n\nThank you.`;
      const { data: queue, error: queueError } = await auth.admin.from("follow_up_queue").insert({
        created_by_id: auth.user.id,
        user_id: auth.user.id,
        customer_name: freshInvoice.customer_name || "",
        customer_email: approvedEmail,
        scheduled_for: new Date().toISOString(),
        status: "pending",
        channel: "email",
        message,
        rule_id: deliveryKey,
      }).select("id,status,created_at,customer_email,message").single();

      if (queueError) {
        if (queueError.code === "23505") {
          await reconcileDelivery(deliveryKey, { claimId: claim.id, invoiceId: invoice.id });
          continue;
        }
        failed += 1;
        logError(
          "runAutopilotMembership:queue",
          new Error(queueError.message || "Membership Autopilot queue insert failed"),
          { claimId: claim.id, invoiceId: invoice.id, dbCode: queueError.code }
        );
        continue;
      }

      prepared += 1;
      if (!resendKey) continue;

      const { outcome } = await deliverAutopilotQueue({
        admin: auth.admin,
        queue,
        resendKey,
        deliveryKey,
        route: "runAutopilotMembership",
        context: { claimId: claim.id, invoiceId: invoice.id },
      });
      countOutcome(outcome, { addPrepared: false });
    }

    const knownInvoiceIds = new Set((invoices || []).map((invoice) => String(invoice.id)));
    skipped += effectiveInvoiceIds.filter((id) => !knownInvoiceIds.has(String(id))).length;

    const completed = prepared > 0 || skipped > 0;
    const retryRequired = Boolean(resendKey) && pending > 0;
    const { data: finalized, error: finalizeError } = await auth.admin
      .from("autopilot_membership_claims")
      .update({
        status: retryRequired ? "failed" : completed ? "completed" : "failed",
        prepared_count: prepared,
        sent_count: sent,
        failed_count: failed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claim.id)
      .eq("status", "running")
      .eq("updated_at", claim.updated_at)
      .select("id")
      .maybeSingle();
    if (finalizeError) throw finalizeError;
    if (!finalized) {
      return res.status(409).json({ error: "This monthly sprint lease changed while it was finishing. Retry to reconcile the recorded deliveries." });
    }

    await recordAutopilotFunnel(auth.admin, {
      userId: auth.user.id,
      eventName: retryRequired ? "run_retryable" : completed ? "run_completed" : "run_failed",
      source: funnelSource,
      mode: "membership",
      invoiceCount: funnelInvoiceCount,
      outcome: retryRequired ? "retryable" : completed ? "completed" : "failed",
    });

    return res.status(retryRequired ? 202 : 200).json({
      success: completed && !retryRequired,
      retryable: retryRequired,
      prepared,
      sent,
      failed,
      skipped,
      pending,
      delivery_mode: resendKey ? "email" : "review_queue",
      period: acquired.period,
      recovered: acquired.recovered,
      error: retryRequired ? "One or more deliveries are awaiting safe retry." : undefined,
    });
  } catch (error) {
    if (executionClaimed) {
      try {
        await recordAutopilotFunnel(auth.admin, {
          userId: auth.user.id,
          eventName: "run_failed",
          source: funnelSource,
          mode: "membership",
          invoiceCount: funnelInvoiceCount,
          outcome: "failed",
        });
      } catch {
        // Metrics never override the execution error.
      }
    }
    const { sendApiError } = await import("../_lib/apiError.js");
    return sendApiError(res, error, {
      route: "runAutopilotMembership",
      category: "automation",
      publicMessage: "The included recovery sprint could not finish",
      publicCode: "AUTOPILOT_MEMBERSHIP_FAILED",
    });
  }
}
