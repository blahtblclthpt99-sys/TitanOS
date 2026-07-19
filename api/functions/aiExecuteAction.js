import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";

/**
 * Execute confirmed Titan AI office actions: schedule job, create estimate, create invoice.
 */
export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Sign in required" });

    const admin = getSupabaseAdmin();
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return res.status(401).json({ error: "Session expired" });
    const user = userData.user;
    const { intent, params = {} } = readJson(req);

    if (intent === "schedule_job" || intent === "create_job") {
      const row = {
        title: params.title || `Job for ${params.customer_name || "Customer"}`,
        customer_name: params.customer_name || "",
        customer_id: params.customer_id || null,
        scheduled_date: params.scheduled_date || new Date().toISOString().slice(0, 10),
        scheduled_time: params.scheduled_time || "09:00",
        status: "scheduled",
        service_type: params.service_type || "General",
        amount: Number(params.amount) || 0,
        notes: params.notes || "Created by Titan AI",
        created_by_id: user.id,
        user_id: user.id,
      };
      const { data, error } = await admin.from("jobs").insert(row).select("*").maybeSingle();
      if (error) throw error;
      return res.status(200).json({
        data: {
          type: "done",
          message: `Scheduled **${data.title}** for ${data.scheduled_date}${data.scheduled_time ? ` at ${data.scheduled_time}` : ""}.`,
          entity: "Job",
          id: data.id,
          path: "/jobs",
        },
      });
    }

    if (intent === "create_estimate") {
      const total = Number(params.total) || Number(params.amount) || 0;
      const row = {
        customer_name: params.customer_name || "",
        customer_id: params.customer_id || null,
        service_type: params.service_type || "General",
        status: "draft",
        total,
        line_items: params.line_items || [{ description: params.title || "Service", qty: 1, unit_price: total, total }],
        notes: params.notes || "Drafted by Titan AI",
        created_by_id: user.id,
        user_id: user.id,
      };
      const { data, error } = await admin.from("estimates").insert(row).select("*").maybeSingle();
      if (error) throw error;
      return res.status(200).json({
        data: {
          type: "done",
          message: `Created estimate draft for **${data.customer_name || "customer"}** · $${total.toLocaleString()}.`,
          entity: "Estimate",
          id: data.id,
          path: "/estimates",
        },
      });
    }

    if (intent === "create_invoice" || intent === "send_invoice") {
      const total = Number(params.total) || Number(params.amount) || 0;
      const row = {
        customer_name: params.customer_name || "",
        customer_id: params.customer_id || null,
        status: intent === "send_invoice" ? "sent" : "draft",
        total,
        balance_due: total,
        due_date: params.due_date || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        notes: params.notes || "Created by Titan AI",
        created_by_id: user.id,
        user_id: user.id,
      };
      const { data, error } = await admin.from("invoices").insert(row).select("*").maybeSingle();
      if (error) throw error;
      return res.status(200).json({
        data: {
          type: "done",
          message: `${intent === "send_invoice" ? "Sent" : "Created"} invoice for **${data.customer_name || "customer"}** · $${total.toLocaleString()}.`,
          entity: "Invoice",
          id: data.id,
          path: "/invoices",
        },
      });
    }

    return res.status(400).json({ error: `Unknown intent: ${intent}` });
  } catch (error) {
    console.error("aiExecuteAction error:", error);
    return res.status(500).json({
      error: error.message || "Could not complete action",
      hint: "Tables may need RLS policies; try creating from the Jobs/Estimates/Invoices screens.",
    });
  }
}
