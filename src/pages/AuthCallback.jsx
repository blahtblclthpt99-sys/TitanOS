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
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        } else {
          // detectSessionInUrl may already have established a session
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          if (!data.session) {
            throw new Error("No session returned. Try again or use email login.");
          }
        }
        if (!cancelled) navigate(from, { replace: true });
      } catch (err) {
        if (!cancelled) setError(err.message || "Sign-in failed");
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
