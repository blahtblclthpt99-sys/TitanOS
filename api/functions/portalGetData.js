import { getSupabaseAdmin, readJson, toEntityRow } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { requirePortalSession } from "../_lib/requirePortalSession.js";
import { logError } from "../_lib/safeLog.js";

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

    const { data: customer, error: customerError } = await admin
      .from("customers")
      .select("id, first_name, last_name, email, created_by_id")
      .eq("id", session.customer_id)
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer) {
      return res.status(404).json({ error: "Account not found" });
    }

    // Verify the session is bound to the correct owning tenant.
    if (session.business_owner_id && customer.created_by_id &&
        session.business_owner_id !== customer.created_by_id) {
      return res.status(403).json({ error: "Portal session tenant mismatch" });
    }

    const [jobsRes, estimatesRes, invoicesRes] = await Promise.all([
      admin
        .from("jobs")
        .select("id, title, service_type, status, scheduled_date, scheduled_time, amount, customer_id, created_at, updated_at")
        .eq("customer_id", customer.id)
        .order("scheduled_date", { ascending: false })
        .limit(50),
      admin
        .from("estimates")
        .select("id, estimate_number, service_type, status, line_items, valid_until, total, customer_id, created_at, updated_at")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("invoices")
        .select("id, invoice_number, due_date, status, total, balance_due, customer_id, created_at, updated_at")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

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
