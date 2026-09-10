import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { readJson } from "../_lib/supabase.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { fetchWithTimeout } from "../_lib/fetchTimeout.js";
import { logError } from "../_lib/safeLog.js";

const RESEND_TIMEOUT_MS = 10_000;
const SAFE_RESEND_RETRY_MS = 23 * 60 * 60 * 1000;
const TERMINAL_INVOICE_STATUSES = new Set(["paid", "void", "cancelled", "refunded"]);

function parseLegacyOrder(note = "") {
  if (!String(note).startsWith("AUTOPILOT:")) return null;
  try {
    return JSON.parse(String(note).slice(10));
  } catch {
    return null;
  }
}

function uniqueInvoiceIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String))].sort();
}

function invoiceDecision(invoice, today) {
  if (!invoice) return { action: "skip", reason: "invoice_missing" };
  if (TERMINAL_INVOICE_STATUSES.has(String(invoice.status || "").toLowerCase())) {
    return { action: "skip", reason: "invoice_not_payable" };
  }
  if (!invoice.due_date || invoice.due_date >= today) {
    return { action: "skip", reason: "invoice_not_overdue" };
  }

  const total = Number(invoice.total || 0);
  const paid = Number(invoice.amount_paid || 0);
  const stored = Number(invoice.balance_due || 0);
  const due = total - paid;
  if (![total, paid, stored, due].every(Number.isFinite) || due <= 0) {
    return { action: "review", reason: "invoice_balance_invalid" };
  }
  if (Math.abs(stored - due) > 0.01) {
    return { action: "review", reason: "invoice_balance_inconsistent" };
  }
  return { action: "send", due };
}

async function loadOrder(auth, paymentId) {
  const { data, error } = await auth.admin
    .from("titan_auto_orders")
    .select("*")
    .eq("payment_id", paymentId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function bootstrapLegacyOrder(auth, payment) {
  const legacy = parseLegacyOrder(payment?.note);
  const invoiceIds = uniqueInvoiceIds(legacy?.invoice_ids);
  if (
    !legacy ||
    legacy.type !== "invoice_recovery_sprint" ||
    Number(legacy.price_cents) !== 900 ||
    invoiceIds.length < 1 ||
    invoiceIds.length > 10
  ) {
    return null;
  }

  const { data: invoices, error: invoiceError } = await auth.admin
    .from("invoices")
    .select("id,customer_email,created_by_id")
    .in("id", invoiceIds)
    .eq("created_by_id", auth.user.id);
  if (invoiceError) throw invoiceError;
  if ((invoices || []).length !== invoiceIds.length) return null;

  // The explicit run action renews approval for the current recipient snapshot
  // when recovering an order created before the server-only ledger existed.
  const approvedRecipients = Object.fromEntries(
    (invoices || []).map((invoice) => [String(invoice.id), String(invoice.customer_email || "").trim()])
  );
  if (Object.values(approvedRecipients).some((email) => !email || email.length > 320)) return null;

  const state = legacy.state === "completed" ? "completed" : "retryable";
  const payload = {
    payment_id: payment.id,
    user_id: auth.user.id,
    checkout_key: `legacy:${payment.id}`,
    order_type: "invoice_recovery_sprint",
    invoice_ids: invoiceIds,
    approved_recipients: approvedRecipients,
    price_cents: 900,
    state,
    approved_at: legacy.approved_at || payment.created_at || new Date().toISOString(),
    completed_at: state === "completed" ? legacy.completed_at || new Date().toISOString() : null,
    sent_count: Number.isInteger(legacy.sent) && legacy.sent >= 0 ? legacy.sent : 0,
    failed_count: Number.isInteger(legacy.failed) && legacy.failed >= 0 ? legacy.failed : 0,
    last_error: state === "retryable" ? "Legacy order recovered into server-owned execution ledger" : null,
  };

  const { data: inserted, error: insertError } = await auth.admin
    .from("titan_auto_orders")
    .insert(payload)
    .select("*")
    .single();
  if (!insertError && inserted) return inserted;
  if (insertError?.code === "23505" || /duplicate|unique/i.test(insertError?.message || "")) {
    return loadOrder(auth, payment.id);
  }
  throw insertError;
}

async function ensureReceipt(auth, order, invoiceId, recipientEmail) {
  const { data: existing, error: findError } = await auth.admin
    .from("titan_auto_delivery_receipts")
    .select("*")
    .eq("order_id", order.id)
    .eq("invoice_id", invoiceId)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing;

  const { data: inserted, error: insertError } = await auth.admin
    .from("titan_auto_delivery_receipts")
    .insert({
      order_id: order.id,
      payment_id: order.payment_id,
      invoice_id: invoiceId,
      user_id: order.user_id,
      recipient_email: recipientEmail || null,
      status: "pending",
    })
    .select("*")
    .single();
  if (!insertError && inserted) return inserted;
  if (insertError?.code === "23505" || /duplicate|unique/i.test(insertError?.message || "")) {
    const { data: raced, error: racedError } = await auth.admin
      .from("titan_auto_delivery_receipts")
      .select("*")
      .eq("order_id", order.id)
      .eq("invoice_id", invoiceId)
      .maybeSingle();
    if (racedError) throw racedError;
    if (raced) return raced;
  }
  throw insertError || new Error("Could not initialize Titan Auto delivery receipt");
}

async function updateReceipt(auth, receiptId, patch) {
  const { data, error } = await auth.admin
    .from("titan_auto_delivery_receipts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", receiptId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function createQueueRow(auth, order, invoice, recipient, message) {
  const { data, error } = await auth.admin
    .from("follow_up_queue")
    .insert({
      created_by_id: auth.user.id,
      user_id: auth.user.id,
      customer_id: null,
      customer_name: invoice.customer_name || "",
      customer_email: recipient,
      job_id: null,
      rule_id: "titan_auto_order",
      scheduled_for: new Date().toISOString(),
      status: "pending",
      channel: "email",
      message,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

async function finishOrder(auth, orderId, { state, sent, failed, skipped, lastError = null }) {
  const completed = state === "completed" || state === "completed_with_review";
  const { error } = await auth.admin
    .from("titan_auto_orders")
    .update({
      state,
      sent_count: sent,
      failed_count: failed,
      skipped_count: skipped,
      lease_expires_at: null,
      completed_at: completed ? new Date().toISOString() : null,
      last_error: lastError,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("user_id", auth.user.id);
  if (error) throw error;
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 5, windowMs: 60_000, key: "runAutopilotOrder" }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;
  let claimedOrderId = null;

  try {
    const { order_id: paymentId } = readJson(req);
    if (!paymentId) return res.status(400).json({ error: "order_id is required" });

    const { data: payment, error: paymentError } = await auth.admin
      .from("payments")
      .select("id,user_id,created_by_id,status,note,created_at")
      .eq("id", paymentId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment || String(payment.created_by_id) !== String(auth.user.id)) {
      return res.status(404).json({ error: "Titan Auto order not found" });
    }
    if (payment.status !== "succeeded") {
      return res.status(409).json({
        error: "Payment is still processing. Try again after Stripe confirms it.",
        payment_status: payment.status,
      });
    }

    let order = await loadOrder(auth, payment.id);
    if (!order) order = await bootstrapLegacyOrder(auth, payment);
    if (!order || order.order_type !== "invoice_recovery_sprint" || Number(order.price_cents) !== 900) {
      return res.status(404).json({ error: "Titan Auto order authority could not be verified" });
    }

    if (order.state === "completed" || order.state === "completed_with_review") {
      return res.status(200).json({
        success: order.state === "completed",
        duplicate: true,
        review_required: order.state === "completed_with_review",
        sent: order.sent_count || 0,
        failed: order.failed_count || 0,
        skipped: order.skipped_count || 0,
      });
    }
    if (order.state === "cancelled") {
      return res.status(409).json({ error: "This Titan Auto order was cancelled before execution." });
    }

    const invoiceIds = uniqueInvoiceIds(order.invoice_ids);
    if (invoiceIds.length < 1 || invoiceIds.length > 10) {
      return res.status(409).json({ error: "Titan Auto order invoice scope is invalid" });
    }

    const { data: preflightInvoices, error: preflightError } = await auth.admin
      .from("invoices")
      .select("id,invoice_number,customer_name,status,balance_due,total,amount_paid,due_date,created_by_id")
      .in("id", invoiceIds)
      .eq("created_by_id", auth.user.id);
    if (preflightError) throw preflightError;

    const today = new Date().toISOString().slice(0, 10);
    const preflightById = new Map((preflightInvoices || []).map((invoice) => [String(invoice.id), invoice]));
    const hasSendable = invoiceIds.some((id) => invoiceDecision(preflightById.get(id), today).action === "send");
    const resendKey = process.env.RESEND_API_KEY;
    if (hasSendable && !resendKey) {
      return res.status(503).json({
        error: "Email delivery is not configured. The paid order remains ready to retry after delivery is configured.",
        code: "EMAIL_DELIVERY_NOT_CONFIGURED",
      });
    }

    const { data: claimRows, error: claimError } = await auth.admin.rpc("claim_titan_auto_execution", {
      p_payment_id: payment.id,
      p_user_id: auth.user.id,
    });
    if (claimError) {
      const message = String(claimError.message || "");
      if (/autopilot_order_already_running/i.test(message)) {
        return res.status(409).json({ error: "This recovery sprint is already running." });
      }
      if (/autopilot_order_already_completed/i.test(message)) {
        order = await loadOrder(auth, payment.id);
        return res.status(200).json({
          success: order?.state === "completed",
          duplicate: true,
          review_required: order?.state === "completed_with_review",
          sent: order?.sent_count || 0,
          failed: order?.failed_count || 0,
          skipped: order?.skipped_count || 0,
        });
      }
      if (/autopilot_payment_not_settled/i.test(message)) {
        return res.status(409).json({ error: "Payment is not settled yet." });
      }
      throw claimError;
    }

    const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;
    if (!claim?.order_id) throw new Error("Titan Auto execution claim returned no order");
    claimedOrderId = claim.order_id;
    order = await loadOrder(auth, payment.id);
    if (!order) throw new Error("Titan Auto order disappeared after execution claim");

    // Re-read invoice state after the execution lease is acquired.
    const { data: invoices, error: invoiceError } = await auth.admin
      .from("invoices")
      .select("id,invoice_number,customer_name,status,balance_due,total,amount_paid,due_date,created_by_id")
      .in("id", invoiceIds)
      .eq("created_by_id", auth.user.id);
    if (invoiceError) throw invoiceError;
    const invoiceById = new Map((invoices || []).map((invoice) => [String(invoice.id), invoice]));
    const approvedRecipients = order.approved_recipients || {};

    let sent = 0;
    let retryableFailed = 0;
    let reviewRequired = 0;
    let skipped = 0;

    for (const invoiceId of invoiceIds) {
      const invoice = invoiceById.get(invoiceId);
      if (!invoice) {
        skipped += 1;
        continue;
      }

      const recipient = String(approvedRecipients[invoiceId] || "").trim();
      let receipt = await ensureReceipt(auth, order, invoice.id, recipient || null);
      if (receipt.status === "sent") {
        sent += 1;
        continue;
      }
      if (receipt.status === "needs_review") {
        reviewRequired += 1;
        continue;
      }

      const decision = invoiceDecision(invoice, today);
      if (decision.action === "skip") {
        await updateReceipt(auth, receipt.id, {
          status: "skipped",
          last_error: decision.reason,
        });
        skipped += 1;
        continue;
      }
      if (decision.action === "review" || !recipient || recipient.length > 320) {
        await updateReceipt(auth, receipt.id, {
          status: "needs_review",
          last_error: decision.action === "review" ? decision.reason : "approved_recipient_invalid",
        });
        reviewRequired += 1;
        continue;
      }

      if (receipt.status === "sending") {
        const attemptedAt = Date.parse(receipt.last_attempt_at || "");
        const ageMs = Number.isFinite(attemptedAt) ? Date.now() - attemptedAt : Number.POSITIVE_INFINITY;
        if (ageMs < 0 || ageMs >= SAFE_RESEND_RETRY_MS) {
          await updateReceipt(auth, receipt.id, {
            status: "needs_review",
            last_error: "Previous delivery result is ambiguous beyond the safe provider retry window",
          });
          reviewRequired += 1;
          continue;
        }
      }

      const balance = Number(decision.due).toFixed(2);
      const message = `Hi ${invoice.customer_name || "there"},\n\nThis is a friendly reminder that invoice ${invoice.invoice_number || invoice.id} for $${balance} was due ${invoice.due_date}. Please contact us if you have already paid or need help with payment.\n\nThank you.`;

      if (!receipt.queue_id) {
        try {
          const queue = await createQueueRow(auth, order, invoice, recipient, message);
          receipt = await updateReceipt(auth, receipt.id, { queue_id: queue.id });
        } catch (queueError) {
          await updateReceipt(auth, receipt.id, {
            status: "failed",
            last_error: `Queue initialization failed: ${queueError?.message || "unknown error"}`,
          });
          retryableFailed += 1;
          continue;
        }
      }

      const attemptAt = new Date().toISOString();
      receipt = await updateReceipt(auth, receipt.id, {
        status: "sending",
        last_attempt_at: attemptAt,
        last_error: null,
      });

      let response;
      try {
        response = await fetchWithTimeout(
          "https://api.resend.com/emails",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
              "Idempotency-Key": `titan-auto/${order.id}/${invoice.id}`,
            },
            body: JSON.stringify({
              from: process.env.RESEND_FROM || "TitanOS <noreply@titanos.app>",
              to: [recipient],
              subject: `Payment reminder — invoice ${invoice.invoice_number || "due"}`,
              text: message,
            }),
          },
          RESEND_TIMEOUT_MS
        );
      } catch (deliveryError) {
        logError("runAutopilotOrder:resend_transport", {
          orderId: order.id,
          invoiceId: invoice.id,
          message: deliveryError?.message || String(deliveryError),
        });
        // Keep `sending`: provider outcome is unknown. A near-term retry uses
        // the same Resend idempotency key; an old ambiguity escalates to review.
        await updateReceipt(auth, receipt.id, {
          last_error: `Delivery result unconfirmed: ${deliveryError?.message || "transport error"}`,
        });
        retryableFailed += 1;
        continue;
      }

      if (response.ok) {
        let responseBody = null;
        try { responseBody = await response.json(); } catch { /* id is optional */ }
        await updateReceipt(auth, receipt.id, {
          status: "sent",
          resend_email_id: responseBody?.id || null,
          sent_at: new Date().toISOString(),
          last_error: null,
        });
        if (receipt.queue_id) {
          await auth.admin
            .from("follow_up_queue")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", receipt.queue_id);
        }
        sent += 1;
        continue;
      }

      if (response.status === 409) {
        await updateReceipt(auth, receipt.id, {
          last_error: "Resend idempotency request is still resolving",
        });
        retryableFailed += 1;
        continue;
      }

      await updateReceipt(auth, receipt.id, {
        status: "failed",
        last_error: `Resend rejected delivery with HTTP ${response.status}`,
      });
      if (receipt.queue_id) {
        await auth.admin.from("follow_up_queue").update({ status: "failed" }).eq("id", receipt.queue_id);
      }
      logError("runAutopilotOrder:resend", {
        orderId: order.id,
        invoiceId: invoice.id,
        status: response.status,
      });
      retryableFailed += 1;
    }

    const failed = retryableFailed + reviewRequired;
    let finalState = "completed";
    let lastError = null;
    if (retryableFailed > 0) {
      finalState = "retryable";
      lastError = `${retryableFailed} delivery attempt(s) remain safely retryable`;
    } else if (reviewRequired > 0) {
      finalState = "completed_with_review";
      lastError = `${reviewRequired} delivery result(s) require manual review to avoid duplicates`;
    }

    await finishOrder(auth, order.id, {
      state: finalState,
      sent,
      failed,
      skipped,
      lastError,
    });
    claimedOrderId = null;

    return res.status(200).json({
      success: finalState === "completed",
      sent,
      failed,
      skipped,
      retryable: finalState === "retryable",
      review_required: finalState === "completed_with_review",
    });
  } catch (error) {
    if (claimedOrderId) {
      try {
        await finishOrder(auth, claimedOrderId, {
          state: "retryable",
          sent: 0,
          failed: 1,
          skipped: 0,
          lastError: `Execution interrupted: ${error?.message || "unknown error"}`,
        });
      } catch (recoveryError) {
        logError("runAutopilotOrder:lease_recovery_failed", {
          orderId: claimedOrderId,
          message: recoveryError?.message || String(recoveryError),
        });
      }
    }
    const { sendApiError } = await import("../_lib/apiError.js");
    return sendApiError(res, error, {
      route: "runAutopilotOrder",
      category: "automation",
      publicMessage: "The recovery sprint could not finish",
      publicCode: "AUTOPILOT_RUN_FAILED",
    });
  }
}
