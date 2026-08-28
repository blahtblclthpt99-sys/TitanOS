import { applyCors, handleOptions } from "../_lib/cors.js";

function cleanVersion(value) {
  const version = String(value || "").trim();
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version) ? version : "";
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const latest = cleanVersion(process.env.APP_LATEST_VERSION);
  const minimum = cleanVersion(process.env.APP_MINIMUM_VERSION);
  if (!latest || !minimum) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({
      error: "App release metadata is not configured",
      code: "APP_VERSION_UNCONFIGURED",
    });
  }

  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  return res.status(200).json({
    latest,
    minimum,
    android_url:
      process.env.ANDROID_STORE_URL ||
      "https://play.google.com/store/apps/details?id=com.titanos.myapp",
    ios_url: process.env.IOS_STORE_URL || "",
  });
}
