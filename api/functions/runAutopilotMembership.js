import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { readJson } from "../_lib/supabase.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { logError } from "../_lib/safeLog.js";
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
    .select("id,status,updated_at,invoice_ids,prepared_count,sent_count,failed_count")
    .eq("user_id", userId)
    .eq("period_key", period)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function acquireMonthlyClaim(admin, userId, requestedInvoiceIds, existingClaim = null) {
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
    if (!originalInvoiceIds.length) {
      return { conflict: "This month's recovery sprint cannot be safely recovered because its original approved batch is unavailable." };
    }

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

  if (!requestedInvoiceIds.length) {
    return { conflict: "Select at least one overdue invoice." };
  }

  const { data: claim, error: claimError } = await admin
    .from("autopilot_membership_claims")
    .insert({ user_id: userId, period_key: period, invoice_ids: requestedInvoiceIds, status: "running" })
    .select("id,status,updated_at,invoice_ids")
    .single();
  if (claimError?.code === "23505") {
    return { conflict: "This month's included recovery sprint has already been claimed." };
  }
  if (claimError) throw claimError;
  return { claim, period, recovered: false, invoiceIds: requestedInvoiceIds };
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
    const requestedInvoiceIds = [...new Set(Array.isArray(body.invoice_ids) ? body.invoice_ids.map(String) : [])]
      .filter(Boolean)
      .slice(0, MAX_INVOICES);
    const today = new Date().toISOString().slice(0, 10);

    // Recovery always uses the original approved monthly batch. A new UI
    // selection must never replace invoice IDs from an interrupted/failed run.
    const existingClaim = await readMonthlyClaim(auth.admin, auth.user.id);
    if (existingClaim?.status === "completed") {
      return res.status(409).json({ error: "This month's included recovery sprint has already been used." });
    }
    if (existingClaim && isFreshRun(existingClaim)) {
      return res.status(409).json({ error: "This month's recovery sprint is already running." });
    }

    if (!existingClaim) {
      if (!requestedInvoiceIds.length) return res.status(400).json({ error: "Select at least one overdue invoice" });
      const { data: requestedInvoices, error: requestedError } = await auth.admin
        .from("invoices")
        .select("id,invoice_number,customer_name,customer_email,status,balance_due,total,due_date,created_by_id")
        .in("id", requestedInvoiceIds)
        .eq("created_by_id", auth.user.id);
      if (requestedError) throw requestedError;
      if ((requestedInvoices || []).length !== requestedInvoiceIds.length || !requestedInvoices.every((invoice) => isStillEligible(invoice, today))) {
        return res.status(400).json({ error: "Every selection must be overdue, unpaid, and have a customer email" });
      }
    }

    const acquired = await acquireMonthlyClaim(auth.admin, auth.user.id, requestedInvoiceIds, existingClaim);
    if (acquired.conflict) return res.status(409).json({ error: acquired.conflict });
    const claim = acquired.claim;
    const effectiveInvoiceIds = (acquired.invoiceIds || []).map(String).filter(Boolean);
    if (!effectiveInvoiceIds.length) {
      return res.status(409).json({ error: "The original approved monthly recovery batch is unavailable." });
    }

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

    for (const invoice of invoices || []) {
      const deliveryKey = `autopilot_run:membership:${claim.id}:${invoice.id}`;
      const prior = await readAutopilotQueue(auth.admin, {
        ownerId: auth.user.id,
        deliveryKey,
      });

      if (prior) {
        const priorOutcome = autopilotQueueOutcome(prior);
        if (priorOutcome !== "pending") {
          countOutcome(priorOutcome);
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

        if (!isStillEligible(freshForRetry, today)) {
          const current = await failAutopilotPending(auth.admin, prior.id, "delivery_unconfirmed_invoice_no_longer_eligible");
          const outcome = autopilotQueueOutcome(current);
          countOutcome(outcome === "missing" ? "pending" : outcome);
          logError(
            "runAutopilotMembership:pending_no_longer_eligible",
            new Error("Pending membership delivery became ineligible before safe retry"),
            { claimId: claim.id, invoiceId: invoice.id, reconciled: outcome }
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

      if (!isStillEligible(freshInvoice, today)) {
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
        if (skipError?.code === "23505") {
          await reconcileDelivery(deliveryKey, { claimId: claim.id, invoiceId: invoice.id });
        } else if (skipError) {
          throw skipError;
        } else {
          skipped += 1;
        }
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
