import { getSupabaseAdmin, readJson, toEntityRow } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
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

    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Missing session token" });
    }

    const { data: sessions } = await admin
      .from("portal_sessions")
      .select("*")
      .eq("token", token)
      .limit(1);

    const session = sessions?.[0];
    if (!session || !session.verified) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
    if (!session.token_expires_at || new Date(session.token_expires_at) < new Date()) {
      return res.status(401).json({ error: "Session expired. Please sign in again." });
    }

    const { data: customer, error: customerError } = await admin
      .from("customers")
      .select("*")
      .eq("id", session.customer_id)
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer) {
      return res.status(404).json({ error: "Account not found" });
    }

    const [jobsRes, estimatesRes, invoicesRes] = await Promise.all([
      admin
        .from("jobs")
        .select("*")
        .eq("customer_id", customer.id)
        .order("scheduled_date", { ascending: false })
        .limit(50),
      admin
        .from("estimates")
        .select("*")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("invoices")
        .select("*")
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
