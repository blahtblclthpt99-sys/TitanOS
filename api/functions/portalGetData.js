import { getSupabaseAdmin, readJson, toEntityRow } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { requirePortalSession } from "../_lib/requirePortalSession.js";
import { logError } from "../_lib/safeLog.js";

const PORTAL_JOB_FIELDS = [
  "id",
  "created_at",
  "updated_at",
  "title",
  "description",
  "customer_id",
  "customer_name",
  "status",
  "priority",
  "service_type",
  "scheduled_date",
  "scheduled_time",
  "estimated_duration",
  "address",
  "amount",
  "completed_at",
].join(",");

const PORTAL_ESTIMATE_FIELDS = [
  "id",
  "created_at",
  "updated_at",
  "estimate_number",
  "customer_id",
  "customer_name",
  "status",
  "line_items",
  "subtotal",
  "tax_rate",
  "tax_amount",
  "discount",
  "total",
  "valid_until",
  "service_type",
  "address",
].join(",");

const PORTAL_INVOICE_FIELDS = [
  "id",
  "created_at",
  "updated_at",
  "invoice_number",
  "customer_id",
  "customer_name",
  "job_id",
  "status",
  "line_items",
  "subtotal",
  "tax_rate",
  "tax_amount",
  "discount",
  "total",
  "amount_paid",
  "balance_due",
  "due_date",
  "payment_method",
  "address",
].join(",");

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!assertRateLimit(req, res, { limit: 60, windowMs: 60_000, key: "portalGetData" })) return;

  try {
    const admin = getSupabaseAdmin();
    const { token } = readJson(req);
    const auth = await requirePortalSession(admin, token);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const session = auth.session;

    if (!session.created_by_id) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    const { data: customer, error: customerError } = await admin
      .from("customers")
      .select("id,first_name,last_name,email,created_by_id")
      .eq("id", session.customer_id)
      .eq("created_by_id", session.created_by_id)
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer || String(customer.email || "").trim().toLowerCase() !== String(session.email || "").trim().toLowerCase()) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    const [jobsRes, estimatesRes, invoicesRes] = await Promise.all([
      admin
        .from("jobs")
        .select(PORTAL_JOB_FIELDS)
        .eq("customer_id", customer.id)
        .eq("created_by_id", session.created_by_id)
        .order("scheduled_date", { ascending: false })
        .limit(50),
      admin
        .from("estimates")
        .select(PORTAL_ESTIMATE_FIELDS)
        .eq("customer_id", customer.id)
        .eq("created_by_id", session.created_by_id)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("invoices")
        .select(PORTAL_INVOICE_FIELDS)
        .eq("customer_id", customer.id)
        .eq("created_by_id", session.created_by_id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    for (const result of [jobsRes, estimatesRes, invoicesRes]) {
      if (result.error) throw result.error;
    }

    return res.status(200).json({
      customer: {
        id: customer.id,
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email,
      },
      jobs: (jobsRes.data || []).map(toEntityRow),
      estimates: (estimatesRes.data || []).map(toEntityRow),
      invoices: (invoicesRes.data || []).map(toEntityRow),
    });
  } catch (error) {
    logError("portalGetData", error);
    captureApiException(error, { tags: { route: "portalGetData" } });
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
