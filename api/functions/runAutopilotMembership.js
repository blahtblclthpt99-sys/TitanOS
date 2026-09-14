import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { readJson } from "../_lib/supabase.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { logError } from "../_lib/safeLog.js";

const MAX_INVOICES = 10;
const STALE_RUN_MS = 15 * 60 * 1000;
const RESEND_RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;
const RESEND_SUBJECT = "Payment reminder — overdue invoice";
const periodKey = () => `${new Date().toISOString().slice(0, 7)}-01`;

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

function pendingCanRetry(queue) {
  if (queue?.status !== "pending" || !queue.created_at) return false;
  const created = new Date(queue.created_at).getTime();
  return Number.isFinite(created) && Date.now() - created < RESEND_RETRY_WINDOW_MS;
}

async function deliverQueuedReminder({ admin, queue, resendKey, deliveryKey, logContext }) {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": deliveryKey,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "TitanOS <noreply@titanos.app>",
        to: [queue.customer_email],
        subject: RESEND_SUBJECT,
        text: queue.message,
      }),
    });

    if (response.ok) {
      const { error: sentError } = await admin
        .from("follow_up_queue")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", queue.id)
        .eq("status", "pending");
      if (sentError) throw sentError;
      return "sent";
    }

    if (response.status === 409) {
      logError("runAutopilotMembership:resend_retryable", { ...logContext, status: response.status });
      return "pending";
    }

    await admin.from("follow_up_queue").update({ status: "failed" }).eq("id", queue.id).eq("status", "pending");
    logError("runAutopilotMembership:resend", { ...logContext, status: response.status });
    return "failed";
  } catch (error) {
    logError("runAutopilotMembership:resend_network", { ...logContext, error: error?.message });
    return "pending";
  }
}

async function acquireMonthlyClaim(admin, userId, invoiceIds) {
  const period = periodKey();
  const { data: existing, error: existingError } = await admin
    .from("autopilot_membership_claims")
    .select("id,status,updated_at,invoice_ids,prepared_count,sent_count,failed_count")
    .eq("user_id", userId)
    .eq("period_key", period)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.status === "completed") {
    return { conflict: "This month's included recovery sprint has already been used." };
  }
  if (existing && isFreshRun(existing)) {
    return { conflict: "This month's recovery sprint is already running." };
  }

  if (existing) {
    // A stale/failed claim resumes the exact originally approved invoice set.
    // Do not let a retry silently substitute a different monthly sprint.
    const originalInvoiceIds = Array.isArray(existing.invoice_ids) && existing.invoice_ids.length
      ? existing.invoice_ids.map(String)
      : invoiceIds;
    const updatedAt = new Date().toISOString();
    const { data: reclaimed, error: reclaimError } = await admin
      .from("autopilot_membership_claims")
      .update({
        invoice_ids: originalInvoiceIds,
        status: "running",
        prepared_count: 0,
        sent_count: 0,
        failed_count: 0,
        updated_at: updatedAt,
      })
      .eq("id", existing.id)
      .eq("status", existing.status)
      .eq("updated_at", existing.updated_at)
      .select("id,status,updated_at,invoice_ids")
      .maybeSingle();
    if (reclaimError) throw reclaimError;
    if (!reclaimed) return { conflict: "This month's recovery sprint changed while it was starting. Try again." };
    return { claim: reclaimed, period, recovered: true, invoiceIds: originalInvoiceIds };
  }

  const { data: claim, error: claimError } = await admin
    .from("autopilot_membership_claims")
    .insert({ user_id: userId, period_key: period, invoice_ids: invoiceIds, status: "running" })
    .select("id,status,updated_at,invoice_ids")
    .single();
  if (claimError?.code === "23505") {
    return { conflict: "This month's included recovery sprint has already been claimed." };
  }
  if (claimError) throw claimError;
  return { claim, period, recovered: false, invoiceIds };
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 4, windowMs: 60_000, key: "runAutopilotMembership" }))) return;
  const auth = await requireUser(req, res);
  if (!auth) return;

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
    const invoiceIds = [...new Set(Array.isArray(body.invoice_ids) ? body.invoice_ids.map(String) : [])].slice(0, MAX_INVOICES);
    if (!invoiceIds.length) return res.status(400).json({ error: "Select at least one overdue invoice" });

    // Validate the current request before consuming or reclaiming the monthly claim.
    const { data: requestedInvoices, error: requestedError } = await auth.admin
      .from("invoices")
      .select("id,invoice_number,customer_name,customer_email,status,balance_due,total,due_date,created_by_id")
      .in("id", invoiceIds)
      .eq("created_by_id", auth.user.id);
    if (requestedError) throw requestedError;

    const today = new Date().toISOString().slice(0, 10);
    if ((requestedInvoices || []).length !== invoiceIds.length || !requestedInvoices.every((invoice) => isStillEligible(invoice, today))) {
      return res.status(400).json({ error: "Every selection must be overdue, unpaid, and have a customer email" });
    }

    const acquired = await acquireMonthlyClaim(auth.admin, auth.user.id, invoiceIds);
    if (acquired.conflict) return res.status(409).json({ error: acquired.conflict });
    const claim = acquired.claim;
    const effectiveInvoiceIds = (acquired.invoiceIds || invoiceIds).map(String);

    // Always re-read the claim's approved set after acquiring the lease. This
    // closes the approval-to-send race and ensures stale recovery uses the
    // original monthly selection rather than a new client payload.
    const { data: invoices, error: invoiceError } = await auth.admin
      .from("invoices")
      .select("id,invoice_number,customer_name,customer_email,status,balance_due,total,due_date,created_by_id")
      .in("id", effectiveInvoiceIds)
      .eq("created_by_id", auth.user.id);
    if (invoiceError) throw invoiceError;

    const resendKey = process.env.RESEND_API_KEY;
    let prepared = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let pending = 0;

    for (const invoice of invoices || []) {
      const deliveryKey = `autopilot_run:membership:${claim.id}:${invoice.id}`;
      const { data: prior, error: priorError } = await auth.admin
        .from("follow_up_queue")
        .select("id,status,created_at,customer_email,message")
        .eq("created_by_id", auth.user.id)
        .eq("rule_id", deliveryKey)
        .maybeSingle();
      if (priorError) throw priorError;

      if (prior) {
        if (prior.status === "sent") {
          prepared += 1;
          sent += 1;
          continue;
        }
        if (prior.status === "failed") {
          prepared += 1;
          failed += 1;
          continue;
        }
        if (prior.status === "skipped") {
          skipped += 1;
          continue;
        }
        if (!resendKey) {
          prepared += 1;
          continue;
        }

        const { data: freshForRetry, error: retryReadError } = await auth.admin
          .from("invoices")
          .select("id,customer_email,status,balance_due,total,due_date,created_by_id")
          .eq("id", invoice.id)
          .eq("created_by_id", auth.user.id)
          .maybeSingle();
        if (retryReadError) throw retryReadError;
        if (!isStillEligible(freshForRetry, today)) {
          await auth.admin.from("follow_up_queue").update({ status: "failed" }).eq("id", prior.id).eq("status", "pending");
          prepared += 1;
          failed += 1;
          logError("runAutopilotMembership:pending_no_longer_eligible", { claimId: claim.id, invoiceId: invoice.id });
          continue;
        }
        if (!pendingCanRetry(prior)) {
          await auth.admin.from("follow_up_queue").update({ status: "failed" }).eq("id", prior.id).eq("status", "pending");
          prepared += 1;
          failed += 1;
          logError("runAutopilotMembership:pending_retry_window_expired", { claimId: claim.id, invoiceId: invoice.id });
          continue;
        }

        prepared += 1;
        const outcome = await deliverQueuedReminder({
          admin: auth.admin,
          queue: prior,
          resendKey,
          deliveryKey,
          logContext: { claimId: claim.id, invoiceId: invoice.id },
        });
        if (outcome === "sent") sent += 1;
        else if (outcome === "failed") failed += 1;
        else pending += 1;
        continue;
      }

      const { data: freshInvoice, error: freshError } = await auth.admin
        .from("invoices")
        .select("id,invoice_number,customer_name,customer_email,status,balance_due,total,due_date,created_by_id")
        .eq("id", invoice.id)
        .eq("created_by_id", auth.user.id)
        .maybeSingle();
      if (freshError) throw freshError;
      if (!isStillEligible(freshInvoice, today)) {
        skipped += 1;
        const message = `Skipped invoice ${invoice.invoice_number || invoice.id}: it is no longer an eligible overdue balance.`;
        const { error: skipError } = await auth.admin.from("follow_up_queue").insert({
          created_by_id: auth.user.id,
          user_id: auth.user.id,
          customer_name: invoice.customer_name || "",
          customer_email: invoice.customer_email || null,
          scheduled_for: new Date().toISOString(),
          status: "skipped",
          channel: "email",
          message,
          rule_id: deliveryKey,
        });
        if (skipError && skipError.code !== "23505") throw skipError;
        continue;
      }

      const balance = Number(freshInvoice.balance_due ?? freshInvoice.total ?? 0).toFixed(2);
      const message = `Hi ${freshInvoice.customer_name || "there"},\n\nThis is a friendly reminder that invoice ${freshInvoice.invoice_number || freshInvoice.id} for $${balance} was due ${freshInvoice.due_date}. Please contact us if you have already paid or need help with payment.\n\nThank you.`;
      const { data: queue, error: queueError } = await auth.admin.from("follow_up_queue").insert({
        created_by_id: auth.user.id,
        user_id: auth.user.id,
        customer_name: freshInvoice.customer_name || "",
        customer_email: freshInvoice.customer_email,
        scheduled_for: new Date().toISOString(),
        status: "pending",
        channel: "email",
        message,
        rule_id: deliveryKey,
      }).select("id,status,created_at,customer_email,message").single();
      if (queueError) {
        if (queueError.code === "23505") {
          pending += resendKey ? 1 : 0;
          prepared += resendKey ? 0 : 1;
          continue;
        }
        failed += 1;
        logError("runAutopilotMembership:queue", { claimId: claim.id, invoiceId: invoice.id, error: queueError.message });
        continue;
      }

      prepared += 1;
      if (!resendKey) continue;

      const outcome = await deliverQueuedReminder({
        admin: auth.admin,
        queue,
        resendKey,
        deliveryKey,
        logContext: { claimId: claim.id, invoiceId: invoice.id },
      });
      if (outcome === "sent") sent += 1;
      else if (outcome === "failed") failed += 1;
      else pending += 1;
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
    const { sendApiError } = await import("../_lib/apiError.js");
    return sendApiError(res, error, {
      route: "runAutopilotMembership",
      category: "automation",
      publicMessage: "The included recovery sprint could not finish",
      publicCode: "AUTOPILOT_MEMBERSHIP_FAILED",
    });
  }
}
