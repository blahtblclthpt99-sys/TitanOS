import { applyCors, handleOptions } from "../_lib/cors.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  return res.status(200).json({
    latest: process.env.APP_LATEST_VERSION || "1.6.1",
    minimum: process.env.APP_MINIMUM_VERSION || "1.6.1",
    android_url:
      process.env.ANDROID_STORE_URL ||
      "https://play.google.com/store/apps/details?id=com.titanos.myapp",
    ios_url: process.env.IOS_STORE_URL || "",
  });
}
