import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";
import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { logError } from "../_lib/safeLog.js";
import { recordAutopilotFunnel } from "../_lib/autopilotFunnel.js";

async function optionalUserId(admin, req) {
  const header = String(req.headers?.authorization || "");
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) throw new Error("Invalid analytics session token");
  return data.user.id;
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!(await assertRateLimitAsync(req, res, {
    limit: 30,
    windowMs: 60_000,
    key: "trackAutopilotEvent",
    requireDurable: true,
  }))) return;

  try {
    const body = readJson(req);
    const admin = getSupabaseAdmin();
    let userId = null;
    try {
      userId = await optionalUserId(admin, req);
    } catch {
      return res.status(401).json({ error: "Session expired. Please sign in again." });
    }

    const tracked = await recordAutopilotFunnel(admin, {
      userId,
      eventName: body.event_name,
      source: body.source,
      mode: body.mode,
      invoiceCount: body.invoice_count,
      outcome: body.outcome,
    });
    if (!tracked) return res.status(400).json({ error: "Unsupported or unavailable Autopilot event" });

    return res.status(202).json({ tracked: true });
  } catch (error) {
    logError("trackAutopilotEvent", error);
    return res.status(503).json({ error: "Autopilot telemetry is temporarily unavailable" });
  }
}
