import { getSupabaseAdmin } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";
import { assertRateLimitAsync } from "../_lib/rateLimit.js";

const PUBLIC_ASSET_PATH = /^public\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[a-z0-9._-]{1,180}$/i;

/**
 * Public delivery bridge for deliberately shareable TitanOS assets.
 *
 * The titanos-uploads bucket remains private. Only objects under the strict
 * public/<user-uuid>/<safe-filename> namespace can be signed by this route.
 * Private customer documents and ordinary <user-uuid>/... objects are never
 * eligible for public delivery.
 */
export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!(await assertRateLimitAsync(req, res, { limit: 180, windowMs: 60_000, key: "publicAsset" }))) return;

  const rawPath = Array.isArray(req.query?.path) ? req.query.path[0] : req.query?.path;
  const path = String(rawPath || "").trim();
  if (!PUBLIC_ASSET_PATH.test(path)) {
    return res.status(400).json({ error: "Invalid public asset path" });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.storage
      .from("titanos-uploads")
      .createSignedUrl(path, 60 * 5);

    if (error || !data?.signedUrl) {
      return res.status(404).json({ error: "Asset not found" });
    }

    res.setHeader("Cache-Control", "public, max-age=240, stale-while-revalidate=60");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.redirect(302, data.signedUrl);
  } catch (error) {
    const { sendApiError } = await import("../_lib/apiError.js");
    return sendApiError(res, error, {
      route: "publicAsset",
      category: "storage",
      publicMessage: "Asset could not be loaded",
      publicCode: "PUBLIC_ASSET_FAILED",
    });
  }
}
