import { readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireUser } from "../_lib/auth.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { requireFeature, FEATURES } from "../_lib/entitlements.js";
import { logError } from "../_lib/safeLog.js";
import { captureApiException } from "../_lib/sentry.js";

/**
 * Server-gated Marketplace Apps install — never trust client-only PremiumGate.
 */
export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!assertRateLimit(req, res, { limit: 20, windowMs: 60_000, key: "installMarketplaceModule" })) return;

  const auth = await requireUser(req, res);
  if (!auth) return;

  const entitled = await requireFeature(res, auth.admin, auth.user, FEATURES.marketplaceApps);
  if (!entitled) return;

  try {
    const body = readJson(req);
    const slug = String(body.module_slug || body.slug || "").trim().slice(0, 120);
    const name = String(body.module_name || body.name || slug).trim().slice(0, 200);
    if (!slug) return res.status(400).json({ error: "module_slug required" });

    const { data: existing } = await auth.admin
      .from("module_installs")
      .select("id, status, module_slug, module_name, installed_at")
      .eq("user_id", auth.user.id)
      .eq("module_slug", slug)
      .maybeSingle();

    if (existing?.status === "active") {
      return res.status(200).json({ installed: existing, alreadyOwned: true });
    }

    const now = new Date().toISOString();
    if (existing) {
      const { data, error } = await auth.admin
        .from("module_installs")
        .update({ status: "active", installed_at: now, module_name: name || existing.module_name })
        .eq("id", existing.id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return res.status(200).json({ installed: data, alreadyOwned: false });
    }

    const { data, error } = await auth.admin
      .from("module_installs")
      .insert({
        user_id: auth.user.id,
        module_slug: slug,
        module_name: name,
        status: "active",
        installed_at: now,
        created_by_id: auth.user.id,
      })
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return res.status(200).json({ installed: data, alreadyOwned: false, free: true });
  } catch (error) {
    logError("installMarketplaceModule", error);
    captureApiException(error, { tags: { route: "installMarketplaceModule" } });
    return res.status(500).json({ error: "Could not install module" });
  }
}
