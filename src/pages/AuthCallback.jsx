import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import AuthLayout from "@/components/AuthLayout";

function collectParams() {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash || "";

  // Hash router: /#/auth/callback?code=...
  const hashQuery = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  const hashParams = new URLSearchParams(hashQuery);

  // Implicit / fragment tokens sometimes land in the hash itself
  const frag = hash.replace(/^#/, "");
  const fragParams = new URLSearchParams(
    frag.includes("=") && !frag.startsWith("/") ? frag : ""
  );

  const get = (key) =>
    params.get(key) || hashParams.get(key) || fragParams.get(key) || "";

  return {
    code: get("code"),
    accessToken: get("access_token"),
    refreshToken: get("refresh_token"),
    oauthError: get("error_description") || get("error"),
    from: get("from") || "/",
  };
}

/** Prevent double exchange (React StrictMode remount / rapid re-entry). */
let exchangeInflight = null;
let exchangedCode = "";

async function exchangeCodeOnce(code) {
  if (exchangedCode === code) {
    return supabase.auth.getSession();
  }
  if (exchangeInflight) return exchangeInflight;

  exchangeInflight = (async () => {
    const result = await supabase.auth.exchangeCodeForSession(code);
    if (!result.error) exchangedCode = code;
    return result;
  })().finally(() => {
    exchangeInflight = null;
  });

  return exchangeInflight;
}

function friendlyAuthError(message) {
  if (/code verifier|pkce/i.test(message || "")) {
    return "Google sign-in could not finish (session lost mid-login). Close extra tabs, then try Continue with Google again.";
  }
  return message || "Sign-in failed";
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const finish = async () => {
      const { code, accessToken, refreshToken, oauthError, from } = collectParams();

      if (oauthError) {
        if (!cancelled) setError(oauthError);
        return;
      }

      try {
        if (code) {
          const { error: exchangeError } = await exchangeCodeOnce(code);
          if (exchangeError) {
            // Another attempt may have already created the session
            const { data } = await supabase.auth.getSession();
            if (!data.session) throw exchangeError;
          }
        } else if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        } else {
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          if (!data.session) {
            throw new Error("No session returned. Try again or use email login.");
          }
        }

        // Clean OAuth params from the URL so refreshes don't re-run exchange
        if (typeof window !== "undefined" && window.history?.replaceState) {
          const clean = `${window.location.pathname}${window.location.hash.split("?")[0] || ""}`;
          window.history.replaceState({}, document.title, clean || "/");
        }

        if (!cancelled) navigate(from, { replace: true });
      } catch (err) {
        if (!cancelled) setError(friendlyAuthError(err.message));
      }
    };

    finish();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <AuthLayout title="Signing you in" subtitle="Completing authentication">
      {error ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
          <Link to="/login" className="text-sm font-semibold text-slate-800 hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <div className="flex justify-center py-6">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      )}
    </AuthLayout>
  );
}
