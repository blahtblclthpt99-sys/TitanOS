import { applyCors, handleOptions } from "../_lib/cors.js";
import { getSupabaseAdmin } from "../_lib/supabase.js";

function normalize(value = "") {
  return String(value || "").trim().replace(/\/(rest|auth)\/v1\/?$/i, "").replace(/\/$/, "");
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") return handleOptions(req, res);
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const serverUrl = normalize(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const clientUrl = normalize(process.env.VITE_SUPABASE_URL);
  const serviceRoleConfigured = Boolean(String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim());
  let serviceRoleOperational = false;

  if (serverUrl && serviceRoleConfigured) {
    try {
      const admin = getSupabaseAdmin();
      const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
      serviceRoleOperational = !error;
    } catch {
      serviceRoleOperational = false;
    }
  }

  return res.status(200).json({
    serverConfigured: Boolean(serverUrl),
    clientConfigured: Boolean(clientUrl),
    projectAligned: Boolean(serverUrl && clientUrl && serverUrl === clientUrl),
    serviceRoleConfigured,
    serviceRoleOperational,
  });
}
