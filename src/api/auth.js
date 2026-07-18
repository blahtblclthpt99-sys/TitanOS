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
    created_date: profile?.created_at || authUser.created_at,
    updated_date: profile?.updated_at || authUser.updated_at,
  };
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getAuthRedirectTo("/auth/callback"),
          data: fullName ? { full_name: fullName } : undefined,
        },
      });
      throwIfError(error);
      return {
        session: data.session,
        user: data.user,
        needsEmailVerification: !data.session,
      };
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
      const redirectTo = getAuthRedirectTo("/auth/callback");
      const options = { redirectTo };
      if (provider === "google") {
        options.queryParams = { access_type: "offline", prompt: "select_account" };
      }
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options,
      });
      throwIfError(error);
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

      if (updates.full_name !== undefined) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ full_name: updates.full_name })
          .eq("id", userId);
        throwIfError(profileError);
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
