import { createClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { createAuthStorage } from "@/lib/auth-storage";

// Vite uses VITE_*; Supabase dashboard snippets often use NEXT_PUBLIC_* / PUBLISHABLE_KEY.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
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
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: "pkce",
    storage: createAuthStorage(),
    // Keep native sessions on device storage even if WebView is cleared mid-OAuth
    storageKey: Capacitor.isNativePlatform()
      ? "titanos-auth-native"
      : "titanos-auth",
  },
});

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
