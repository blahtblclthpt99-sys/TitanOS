import { requireUser } from "../_lib/auth.js";
import { logError } from "../_lib/safeLog.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "no-store");

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const now = new Date().toISOString();
    const { data, error } = await auth.admin
      .from("account_deletion_requests")
      .upsert(
        {
          user_id: auth.user.id,
          email_snapshot: auth.user.email || null,
          status: "pending",
          requested_at: now,
          completed_at: null,
          updated_at: now,
        },
        { onConflict: "user_id" }
      )
      .select("id,status,requested_at")
      .single();

    if (error) throw error;

    return res.status(200).json({
      ok: true,
      request: data,
      message: "Your TitanOS account deletion request has been recorded.",
    });
  } catch (error) {
    logError("accountDeletionRequest", error);
    return res.status(500).json({ error: "Could not record the deletion request. Please try again." });
  }
}
