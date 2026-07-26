import { getSupabaseAdmin } from "../_lib/supabase.js";
import { MARKETPLACE_MODULES, MODULE_PRICE } from "../../src/lib/marketplaceCatalog.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { requireAdmin } from "../_lib/auth.js";
import { assertRateLimit } from "../_lib/rateLimit.js";
import { captureApiException } from "../_lib/sentry.js";
import { logError } from "../_lib/safeLog.js";
import { secretsEqual } from "../_lib/secureCompare.js";

/**
 * Admin-only marketplace catalog seed / sync.
 * Upserts all static catalog modules at MODULE_PRICE (0 — included with Premium).
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
  const secretOk = Boolean(seedSecret) && secretsEqual(headerSecret, seedSecret);

  if (!secretOk) {
    const auth = await requireAdmin(req, res);
    if (!auth) return;
  }

  try {
    const admin = getSupabaseAdmin();
    const rows = MARKETPLACE_MODULES.map((module) => ({
      slug: module.slug,
      name: module.name,
      description: module.description,
      category: module.category,
      rating: module.rating,
      review_count: module.review_count,
      price: MODULE_PRICE,
      price_label: module.price_label || "",
      icon: module.icon,
      gradient: module.gradient,
      features: module.features,
      install_count: module.install_count,
      verified: module.verified,
      status: module.status,
      route: module.route || null,
    }));

    let upserted = 0;
    let inserted = 0;
    for (const row of rows) {
      const { data: existing } = await admin
        .from("marketplace_modules")
        .select("id")
        .eq("slug", row.slug)
        .maybeSingle();
      if (existing?.id) {
        const { error } = await admin.from("marketplace_modules").update(row).eq("id", existing.id);
        if (error) throw error;
        upserted += 1;
      } else {
        const { error } = await admin.from("marketplace_modules").insert(row);
        if (error) throw error;
        inserted += 1;
      }
    }

    // Align any leftover rows to MODULE_PRICE
    await admin
      .from("marketplace_modules")
      .update({ price: MODULE_PRICE, price_label: "" })
      .not("slug", "is", null);

    return res.status(200).json({
      seeded: true,
      inserted,
      updated: upserted,
      price: MODULE_PRICE,
      count: rows.length,
    });
  } catch (error) {
    logError("seedMarketplace", error);
    captureApiException(error, { tags: { route: "seedMarketplace" } });
    return res.status(500).json({ error: "Seed failed" });
  }
}
