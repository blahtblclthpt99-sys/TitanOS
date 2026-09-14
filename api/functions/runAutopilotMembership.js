import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { readJson } from "../_lib/supabase.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { logError } from "../_lib/safeLog.js";

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

async function acquireMonthlyClaim(admin, userId, invoiceIds) {
  const period = periodKey();
  const { data: existing, error: existingError } = await admin
    .from("autopilot_membership_claims")
    .select("id,status,updated_at,prepared_count,sent_count,failed_count")
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
    const { data: reclaimed, error: reclaimError } = await admin
      .from("autopilot_membership_claims")
      .update({
        invoice_ids: invoiceIds,
        status: "running",
        prepared_count: 0,
        sent_count: 0,
        failed_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("status", existing.status)
      .select("id,status,updated_at")
      .maybeSingle();
    if (reclaimError) throw reclaimError;
    if (!reclaimed) return { conflict: "This month's recovery sprint changed while it was starting. Try again." };
    return { claim: reclaimed, period, recovered: true };
  }

  const { data: claim, error: claimError } = await admin
    .from("autopilot_membership_claims")
    .insert({ user_id: userId, period_key: period, invoice_ids: invoiceIds, status: "running" })
    .select("id,status,updated_at")
    .single();
  if (claimError?.code === "23505") {
    return { conflict: "This month's included recovery sprint has already been claimed." };
  }
  if (claimError) throw claimError;
  return { claim, period, recovered: false };
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

    const { data: invoices, error: invoiceError } = await auth.admin
      .from("invoices")
      .select("id,invoice_number,customer_name,customer_email,status,balance_due,total,due_date,created_by_id")
      .in("id", invoiceIds)
      .eq("created_by_id", auth.user.id);
    if (invoiceError) throw invoiceError;

    const today = new Date().toISOString().slice(0, 10);
    if ((invoices || []).length !== invoiceIds.length || !invoices.every((invoice) => isStillEligible(invoice, today))) {
      return res.status(400).json({ error: "Every selection must be overdue, unpaid, and have a customer email" });
    }

    const acquired = await acquireMonthlyClaim(auth.admin, auth.user.id, invoiceIds);
    if (acquired.conflict) return res.status(409).json({ error: acquired.conflict });
    const claim = acquired.claim;

    const resendKey = process.env.RESEND_API_KEY;
    let prepared = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const invoice of invoices) {
      const deliveryKey = `autopilot_run:membership:${claim.id}:${invoice.id}`;
      const { data: prior } = await auth.admin
        .from("follow_up_queue")
        .select("id,status")
        .eq("created_by_id", auth.user.id)
        .eq("rule_id", deliveryKey)
        .maybeSingle();
      if (prior) {
        prepared += 1;
        if (prior.status === "sent") sent += 1;
        else if (prior.status === "failed") failed += 1;
        else skipped += 1;
        continue;
      }

      // Re-read just before creating a delivery. An invoice paid after the user
      // approved the batch is automatically stopped instead of being reminded.
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
        await auth.admin.from("follow_up_queue").insert({
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
      }).select("id").single();
      if (queueError) {
        if (queueError.code === "23505") {
          skipped += 1;
          continue;
        }
        failed += 1;
        logError("runAutopilotMembership:queue", { claimId: claim.id, invoiceId: invoice.id, error: queueError.message });
        continue;
      }

      prepared += 1;
      if (!resendKey) continue;

      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: process.env.RESEND_FROM || "TitanOS <noreply@titanos.app>",
            to: [freshInvoice.customer_email],
            subject: `Payment reminder — invoice ${freshInvoice.invoice_number || "due"}`,
            text: message,
          }),
        });
        if (response.ok) {
          sent += 1;
          await auth.admin
            .from("follow_up_queue")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", queue.id);
        } else {
          failed += 1;
          await auth.admin.from("follow_up_queue").update({ status: "failed" }).eq("id", queue.id);
          logError("runAutopilotMembership:resend", { claimId: claim.id, invoiceId: invoice.id, status: response.status });
        }
      } catch (error) {
        failed += 1;
        await auth.admin.from("follow_up_queue").update({ status: "failed" }).eq("id", queue.id);
        logError("runAutopilotMembership:resend_network", { claimId: claim.id, invoiceId: invoice.id, error: error?.message });
      }
    }

    const completed = prepared > 0 || skipped > 0;
    await auth.admin.from("autopilot_membership_claims").update({
      status: completed ? "completed" : "failed",
      prepared_count: prepared,
      sent_count: sent,
      failed_count: failed,
      updated_at: new Date().toISOString(),
    }).eq("id", claim.id);

    return res.status(200).json({
      success: completed,
      prepared,
      sent,
      failed,
      skipped,
      delivery_mode: resendKey ? "email" : "review_queue",
      period: acquired.period,
      recovered: acquired.recovered,
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
