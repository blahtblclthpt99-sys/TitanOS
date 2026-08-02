import { createClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { createAuthStorage } from "@/lib/auth-storage";
import { normalizeSupabaseUrl } from "@/lib/supabaseUrl";
import { envString } from "@/lib/viteEnv";

// Vite uses VITE_*; Supabase dashboard snippets often use NEXT_PUBLIC_* / PUBLISHABLE_KEY.
const supabaseUrl = normalizeSupabaseUrl(
  envString("VITE_SUPABASE_URL") || envString("NEXT_PUBLIC_SUPABASE_URL") || ""
);
const supabaseAnonKey =
  envString("VITE_SUPABASE_ANON_KEY") ||
  envString("VITE_SUPABASE_PUBLISHABLE_KEY") ||
  envString("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
  "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local"
  );
}

/**
 * detectSessionInUrl must stay false:
 * AuthCallback exchanges the PKCE code once. Auto-detect + callback = double
 * exchange → "PKCE code verifier not found in storage" (also triggered by React StrictMode).
 */
/** Keep in sync with `AUTH_STORAGE_KEYS` in `src/lib/sessionPeek.js`. */
export const SUPABASE_AUTH_STORAGE_KEY = Capacitor.isNativePlatform()
  ? "titanos-auth-native"
  : "titanos-auth";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: envString("MODE") !== "test",
    detectSessionInUrl: false,
    flowType: "pkce",
    storage: createAuthStorage(),
    // Keep native sessions on device storage even if WebView is cleared mid-OAuth
    storageKey: SUPABASE_AUTH_STORAGE_KEY,
  },
});

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
