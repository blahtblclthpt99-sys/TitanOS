import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { readJson } from "../_lib/supabase.js";
import { assertRateLimit } from "../_lib/rateLimit.js";

const ALLOWED = new Set(["job_seeker", "self_employed", "business"]);

function cleanList(value) {
  const rows = Array.isArray(value) ? value : [];
  return [...new Set(rows.map((item) => String(item || "").trim().toLowerCase()).filter((item) => ALLOWED.has(item)))];
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!assertRateLimit(req, res, { limit: 20, windowMs: 60_000, key: "setWorkspaces" })) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  const body = readJson(req);
  const enabled = cleanList(body.enabled_workspaces || body.enabledWorkspaces);
  const active = String(body.active_workspace || body.activeWorkspace || "").trim().toLowerCase();

  if (!enabled.length) {
    return res.status(400).json({ error: "Enable at least one Titan workspace." });
  }
  if (!ALLOWED.has(active) || !enabled.includes(active)) {
    return res.status(400).json({ error: "The active workspace must be one of your enabled workspaces." });
  }

  const { data: existing, error: loadError } = await auth.admin
    .from("profiles")
    .select("plan_tier,professional_profile")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (loadError) return res.status(400).json({ error: "Could not load account profile." });

  const professionalProfile = existing?.professional_profile && typeof existing.professional_profile === "object"
    ? existing.professional_profile
    : {};

  const updates = {
    enabled_workspaces: enabled,
    active_workspace: active,
    // Keep the legacy field usable by old builds without inventing new billing tiers.
    account_type: active === "business" ? "business" : "worker",
    professional_profile: {
      ...professionalProfile,
      enabled_workspaces: enabled,
      active_workspace: active,
    },
    updated_at: new Date().toISOString(),
  };

  // Workspace identity is never a plan entitlement. Ensure a legacy blank plan
  // resolves to the free worker plan before writing Business as a workspace.
  if (!String(existing?.plan_tier || "").trim()) updates.plan_tier = "worker_free";

  const { error: updateError } = await auth.admin
    .from("profiles")
    .update(updates)
    .eq("id", auth.user.id);
  if (updateError) return res.status(400).json({ error: "Could not update Titan workspaces." });

  return res.status(200).json({
    enabled_workspaces: enabled,
    active_workspace: active,
    plan_changed: false,
  });
}
