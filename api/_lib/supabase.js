import { createClient } from "@supabase/supabase-js";

let cachedAdmin = null;
let cachedAdminUrl = "";
let cachedAdminKey = "";

function normalizeSupabaseUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/\/(rest|auth)\/v1\/?$/i, "").replace(/\/$/, "");
}

function standardSupabaseProjectRef(value = "") {
  const normalized = normalizeSupabaseUrl(value);
  if (!normalized) return "";
  try {
    const host = new URL(normalized).hostname.toLowerCase();
    if (!host.endsWith(".supabase.co")) return "";
    const ref = host.slice(0, -".supabase.co".length);
    return /^[a-z0-9]+$/.test(ref) ? ref : "";
  } catch {
    return "";
  }
}

/**
 * When both server and browser URLs are canonical Supabase project URLs, they
 * must resolve to the same project ref. A mismatch would create split-brain
 * auth/data behavior (for example, server writes to Attention while the TitanOS
 * browser authenticates against Recovery Staging), so fail closed.
 *
 * Custom domains are not guessed here because their underlying project cannot
 * be proven from the hostname alone; those still require deployment E2E.
 */
export function assertSupabaseProjectConsistency({
  serverUrl = process.env.SUPABASE_URL,
  clientUrl = process.env.VITE_SUPABASE_URL,
} = {}) {
  const serverRef = standardSupabaseProjectRef(serverUrl);
  const clientRef = standardSupabaseProjectRef(clientUrl);
  if (serverRef && clientRef && serverRef !== clientRef) {
    throw new Error("Supabase server/client project mismatch");
  }
  return true;
}

export function getSupabaseAdmin() {
  assertSupabaseProjectConsistency();
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  if (!cachedAdmin || cachedAdminUrl !== url || cachedAdminKey !== key) {
    cachedAdmin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    cachedAdminUrl = url;
    cachedAdminKey = key;
  }

  return cachedAdmin;
}

export function getSupabaseAnonKey() {
  return (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ""
  );
}

export function readJson(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }
  return {};
}

export function toEntityRow(row) {
  if (!row) return row;
  return {
    ...row,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}