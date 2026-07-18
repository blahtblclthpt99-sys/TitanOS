import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";
import { MARKETPLACE_MODULES } from "../../src/lib/marketplaceCatalog.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const admin = getSupabaseAdmin();
    const { count, error: countError } = await admin
      .from("marketplace_modules")
      .select("*", { count: "exact", head: true });
    if (countError) throw countError;

    if (count && count > 0) {
      return res.status(200).json({ seeded: false, count });
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
    console.error("seedMarketplace error:", error);
    return res.status(500).json({ error: error.message || "Seed failed" });
  }
}
