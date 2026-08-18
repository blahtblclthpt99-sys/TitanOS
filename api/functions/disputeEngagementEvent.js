import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { readJson } from "../_lib/supabase.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 12, windowMs: 60_000, key: "disputeEngagementEvent" }))) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  const body = readJson(req);
  const eventId = String(body.event_id || body.eventId || "").trim();
  const reason = String(body.reason || "").trim();
  if (!eventId) return res.status(400).json({ error: "Interaction event is required." });
  if (reason.length < 3 || reason.length > 2000) return res.status(400).json({ error: "Explain what is incorrect in 3–2000 characters." });

  const { data: event, error: eventError } = await auth.admin
    .from("engagement_interaction_events")
    .select("id,subject_user_id,counterparty_user_id,disputed")
    .eq("id", eventId)
    .maybeSingle();
  if (eventError || !event) return res.status(404).json({ error: "Interaction event not found." });

  if (event.subject_user_id !== auth.user.id && event.counterparty_user_id !== auth.user.id) {
    return res.status(403).json({ error: "You can only dispute an interaction you participated in." });
  }

  const { data: dispute, error: disputeError } = await auth.admin
    .from("engagement_event_disputes")
    .upsert({
      event_id: eventId,
      raised_by_id: auth.user.id,
      reason,
      status: "open",
      resolution_note: null,
      resolved_at: null,
    }, { onConflict: "event_id,raised_by_id" })
    .select("id,event_id,status,created_at")
    .maybeSingle();
  if (disputeError) return res.status(400).json({ error: "Could not submit the dispute." });

  // The raw event remains intact for audit. This marker makes the derived signal
  // immediately neutral while the challenge is unresolved.
  const { error: markError } = await auth.admin
    .from("engagement_interaction_events")
    .update({ disputed: true })
    .eq("id", eventId);
  if (markError) return res.status(400).json({ error: "The dispute was saved, but the Engagement signal could not be paused." });

  return res.status(200).json({ data: dispute, engagement_effect: "neutral_while_disputed" });
}
