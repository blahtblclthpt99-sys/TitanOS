import { readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireAdmin } from "../_lib/auth.js";
import { assertRateLimit } from "../_lib/rateLimit.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!assertRateLimit(req, res, { limit: 30, windowMs: 60_000, key: "adminControl" })) return;
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const input = readJson(req);
  const action = String(input.action || "summary");
  try {
    if (action === "summary") {
      const [users, feedback, jobs, listings] = await Promise.all([
        auth.admin.from("profiles").select("id", { count: "exact", head: true }),
        auth.admin.from("beta_feedbacks").select("id", { count: "exact", head: true }).eq("status", "unread"),
        auth.admin.from("jobs").select("id", { count: "exact", head: true }),
        auth.admin.from("marketplace_listings").select("id", { count: "exact", head: true }),
      ]);
      return res.status(200).json({
        counts: { users: users.count || 0, unread_feedback: feedback.count || 0, jobs: jobs.count || 0, listings: listings.count || 0 },
        health: { database: users.error ? "degraded" : "healthy", server: "healthy", stripe: process.env.STRIPE_SECRET_KEY ? "configured" : "not configured" },
      });
    }
    if (action === "users") {
      const { data, error } = await auth.admin.from("profiles").select("id,email,full_name,role,created_at,paying_subscriber").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return res.status(200).json({ users: data || [] });
    }
    if (action === "feedback") {
      const { data, error } = await auth.admin.from("beta_feedbacks").select("*").order("created_at", { ascending: false }).limit(250);
      if (error) throw error;
      return res.status(200).json({ feedback: data || [] });
    }
    if (action === "feedback_status") {
      if (!["unread", "in_progress", "completed"].includes(input.status)) return res.status(400).json({ error: "Invalid status" });
      const { error } = await auth.admin.from("beta_feedbacks").update({ status: input.status }).eq("id", input.id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }
    if (action === "suspend" || action === "restore") {
      if (!input.user_id || input.user_id === auth.user.id) return res.status(400).json({ error: "Invalid user" });
      const { error } = await auth.admin.auth.admin.updateUserById(input.user_id, {
        ban_duration: action === "suspend" ? "876000h" : "none",
      });
      if (error) throw error;
      return res.status(200).json({ success: true });
    }
    return res.status(400).json({ error: "Unknown action" });
  } catch {
    return res.status(500).json({ error: "Administrator request failed" });
  }
}
