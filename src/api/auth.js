import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { supabase } from "./supabaseClient";
import { getAuthRedirectTo } from "@/lib/auth-redirect";

function apiError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function throwIfError(error, status = 400) {
  if (!error) return;
  throw apiError(error.message || "Request failed", status);
}

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  throwIfError(error);
  return data;
}

async function buildUser(authUser, profile) {
  if (!authUser) return null;
  return {
    id: authUser.id,
    email: authUser.email,
    full_name:
      profile?.full_name ||
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      "",
    role: profile?.role || "user",
    is_pro: profile?.is_pro ?? false,
    lifetime_premium: profile?.lifetime_premium ?? false,
    paying_subscriber: profile?.paying_subscriber ?? false,
    plan_tier: profile?.plan_tier || "",
    account_type: profile?.account_type || "",
    phone: profile?.phone || "",
    username: profile?.username || "",
    avatar_url: profile?.avatar_url || "",
    bio: profile?.bio || "",
    city: profile?.city || "",
    state: profile?.state || "",
    company_name: profile?.company_name || "",
    company_address: profile?.company_address || "",
    company_city: profile?.company_city || "",
    company_state: profile?.company_state || "",
    company_zip: profile?.company_zip || "",
    company_logo_url: profile?.company_logo_url || "",
    theme_pref: profile?.theme_pref || "system",
    notification_prefs: profile?.notification_prefs || {},
    privacy_prefs: profile?.privacy_prefs || {},
    community_opt_in: profile?.community_opt_in ?? false,
    referral_code: profile?.referral_code || "",
    referred_by_code: profile?.referred_by_code || "",
    verified_worker: profile?.verified_worker ?? false,
    verification_notes: profile?.verification_notes || "",
    active_company_id: profile?.active_company_id || "",
    created_date: profile?.created_at || authUser.created_at,
    updated_date: profile?.updated_at || authUser.updated_at,
  };
}

async function assertOAuthProviderEnabled(provider) {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !anon) return;
  try {
    const res = await fetch(`${base}/auth/v1/settings`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    });
    if (!res.ok) return;
    const settings = await res.json();
    const key = provider === "azure" ? "azure" : provider;
    if (settings?.external && settings.external[key] === false) {
      const label = provider === "google" ? "Google" : provider;
      throw apiError(
        `${label} sign-in is not enabled yet in Supabase. Use email, or finish GOOGLE_AUTH.md setup.`,
        400
      );
    }
  } catch (err) {
    if (err?.status) throw err;
    // Network hiccup — let OAuth attempt proceed
  }
}

async function registerViaServer({ email, password, fullName }) {
  const bases = [];
  const configured = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (configured) bases.push(configured);
  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".vercel.app")) {
      bases.push(origin);
    }
    // Always allow production API as last resort (Capacitor / IONOS)
    bases.push("https://titanos-web.vercel.app");
  }

  let lastError;
  for (const base of [...new Set(bases)]) {
    try {
      const response = await fetch(`${base}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw apiError(body.error || "Registration failed", response.status);
      }
      if (body.session?.access_token && body.session?.refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token: body.session.access_token,
          refresh_token: body.session.refresh_token,
        });
        throwIfError(error);
      }
      return {
        session: body.session || null,
        user: body.user || null,
        needsEmailVerification: Boolean(body.needsEmailVerification),
      };
    } catch (err) {
      lastError = err;
      // Only fall through on network / unavailable host
      if (err?.status && err.status !== 404 && err.status !== 502 && err.status !== 503) {
        throw err;
      }
    }
  }
  throw lastError || apiError("Registration unavailable", 503);
}

export function createAuthModule() {
  return {
    async me() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        throw apiError("Authentication required", 401);
      }
      const profile = await fetchProfile(data.user.id);
      return buildUser(data.user, profile);
    },

    async loginViaEmailPassword(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      throwIfError(error, 401);
    },

    async register({ email, password, fullName }) {
      // Prefer server register — avoids Supabase built-in mailer rate limits
      // and confirms the account immediately for Play testers.
      try {
        return await registerViaServer({ email, password, fullName });
      } catch (serverError) {
        // Fall back to direct Supabase signup when API is unavailable
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getAuthRedirectTo("/auth/callback"),
            data: fullName ? { full_name: fullName } : undefined,
          },
        });
        if (error) {
          if (/rate limit/i.test(error.message || "")) {
            throw apiError(
              serverError?.message ||
                "Sign-up is temporarily limited. Try again in a few minutes, or use Google once it is enabled.",
              429
            );
          }
          throwIfError(error);
        }
        return {
          session: data.session,
          user: data.user,
          needsEmailVerification: !data.session,
        };
      }
    },

    async verifyOtp({ email, otpCode }) {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "signup",
      });
      throwIfError(error);
      return { access_token: data.session?.access_token, session: data.session };
    },

    async resendOtp(email) {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      throwIfError(error);
    },

    async loginWithGoogle() {
      return this.loginWithProvider("google");
    },

    async loginWithProvider(provider) {
      await assertOAuthProviderEnabled(provider);

      const redirectTo = getAuthRedirectTo("/auth/callback");
      const isNative = Capacitor.isNativePlatform();
      const options = {
        redirectTo,
        // Always get the URL first so we can open Browser on native,
        // and avoid a blank 400 page if the provider was just disabled.
        skipBrowserRedirect: true,
      };
      if (provider === "google") {
        options.queryParams = { access_type: "offline", prompt: "select_account" };
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options,
      });
      throwIfError(error);
      if (!data?.url) throw apiError("Could not start sign-in. Try again.", 400);

      if (isNative) {
        // Give async Preferences storage a tick to flush the PKCE verifier
        // before leaving the WebView for the system browser.
        await new Promise((r) => setTimeout(r, 50));
        await Browser.open({ url: data.url, presentationStyle: "popover" });
      } else {
        window.location.assign(data.url);
      }

      return data;
    },

    async resetPasswordRequest(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectTo("/reset-password"),
      });
      throwIfError(error);
    },

    async resetPassword({ newPassword }) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      throwIfError(error);
    },

    async updateMe(updates) {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      throwIfError(authError, 401);
      const userId = authData.user?.id;
      if (!userId) throw apiError("Authentication required", 401);

      const allowed = [
        "full_name",
        "phone",
        "username",
        "avatar_url",
        "bio",
        "city",
        "state",
        "company_name",
        "company_address",
        "company_city",
        "company_state",
        "company_zip",
        "company_logo_url",
        "theme_pref",
        "notification_prefs",
        "privacy_prefs",
        "community_opt_in",
        "referral_code",
        "referred_by_code",
        "verified_worker",
        "verification_notes",
        "active_company_id",
        "plan_tier",
        "account_type",
      ];

      const payload = {};
      for (const key of allowed) {
        if (updates[key] !== undefined) payload[key] = updates[key];
      }

      if (Object.keys(payload).length > 0) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update(payload)
          .eq("id", userId);
        throwIfError(profileError);
      }

      if (updates.password) {
        const { error: pwError } = await supabase.auth.updateUser({ password: updates.password });
        throwIfError(pwError);
      }

      if (updates.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: updates.email });
        throwIfError(emailError);
      }

      return this.me();
    },

    setToken(accessToken) {
      return supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: "",
      });
    },

    async logout(redirectTo) {
      await supabase.auth.signOut();
      if (redirectTo && redirectTo !== false) {
        window.location.href = redirectTo;
      }
    },

    redirectToLogin(fromUrl = window.location.href) {
      const loginUrl = `/login?from_url=${encodeURIComponent(fromUrl)}`;
      window.location.href = loginUrl;
    },
  };
}
