import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { MARKETPLACE_MODULES } from "../../src/lib/marketplaceCatalog.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireAdmin } from "../_lib/auth.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";

/**
 * Admin-only marketplace catalog seed. Disabled unless caller is admin
 * (or SEED_MARKETPLACE_SECRET matches header x-seed-secret).
 */
export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!assertRateLimit(req, res, { limit: 5, windowMs: 60_000, key: "seedMarketplace" })) return;

  const seedSecret = process.env.SEED_MARKETPLACE_SECRET;
  const headerSecret = req.headers["x-seed-secret"];
  const secretOk = seedSecret && headerSecret && headerSecret === seedSecret;

  if (!secretOk) {
    const auth = await requireAdmin(req, res);
    if (!auth) return;
  }

  try {
    const admin = getSupabaseAdmin();
    const { count, error: countError } = await admin
      .from("marketplace_modules")
      .select("*", { count: "exact", head: true });
    if (countError) throw countError;

    if (count && count > 0) {
      // Keep catalog free even if rows already exist from an older paid seed
      const { error: zeroErr } = await admin
        .from("marketplace_modules")
        .update({ price: 0, price_label: "Free" })
        .not("slug", "is", null);
      if (zeroErr) throw zeroErr;
      return res.status(200).json({ seeded: false, pricesZeroed: true, count });
    }

    const rows = MARKETPLACE_MODULES.map((module) => ({
      slug: module.slug,
      name: module.name,
      description: module.description,
      category: module.category,
      rating: module.rating,
      review_count: module.review_count,
      price: module.price,
      price_label: module.price_label,
      icon: module.icon,
      gradient: module.gradient,
      features: module.features,
      install_count: module.install_count,
      verified: module.verified,
      status: module.status,
      route: module.route || null,
    }));

    const { error } = await admin.from("marketplace_modules").insert(rows);
    if (error) throw error;

    return res.status(200).json({ seeded: true, count: rows.length });
  } catch (error) {
    logError("seedMarketplace", error);
    captureApiException(error, { tags: { route: "seedMarketplace" } });
    return res.status(500).json({ error: "Seed failed" });
  }
}
