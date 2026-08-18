import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { readJson } from "../_lib/supabase.js";
import { assertRateLimit } from "../_lib/rateLimit.js";

const ALLOWED = new Set(["business", "job_seeker"]);

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!assertRateLimit(req, res, { limit: 12, windowMs: 60_000, key: "setAccountType" })) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  const body = readJson(req);
  const accountType = String(body.account_type || body.accountType || "").trim().toLowerCase();
  if (!ALLOWED.has(accountType)) {
    return res.status(400).json({ error: "Choose Job Seeker or Business." });
  }

  const { data: existing, error: loadError } = await auth.admin
    .from("profiles")
    .select("plan_tier")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (loadError) return res.status(400).json({ error: "Could not load account profile." });

  // Account experience never grants a paid plan. Legacy rows with no explicit
  // plan are pinned to worker_free before account_type changes so plan resolution
  // cannot accidentally treat "business" as a billing entitlement.
  const updates = {
    account_type: accountType,
    updated_at: new Date().toISOString(),
  };
  if (!String(existing?.plan_tier || "").trim()) updates.plan_tier = "worker_free";

  const { error: updateError } = await auth.admin
    .from("profiles")
    .update(updates)
    .eq("id", auth.user.id);
  if (updateError) return res.status(400).json({ error: "Could not update account type." });

  return res.status(200).json({ account_type: accountType, plan_changed: false });
}
