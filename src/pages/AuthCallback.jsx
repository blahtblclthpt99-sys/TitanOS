import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import AuthLayout from "@/components/AuthLayout";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const finish = async () => {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash || "";
      const hashQuery = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
      const hashParams = new URLSearchParams(hashQuery.replace(/^#/, ""));
      const fragParams = new URLSearchParams(
        window.location.hash.replace(/^#/, "").replace(/^\/?auth\/callback\?/, "")
      );

      const code = params.get("code") || hashParams.get("code") || fragParams.get("code");
      const accessToken =
        params.get("access_token") || hashParams.get("access_token") || fragParams.get("access_token");
      const refreshToken =
        params.get("refresh_token") || hashParams.get("refresh_token") || fragParams.get("refresh_token");
      const oauthError =
        params.get("error_description") ||
        params.get("error") ||
        hashParams.get("error_description") ||
        fragParams.get("error_description");
      const from = params.get("from") || hashParams.get("from") || "/";

      if (oauthError) {
        setError(oauthError);
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
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          if (!data.session) {
            throw new Error("No session returned. Try again or use email login.");
          }
        }
        navigate(from, { replace: true });
      } catch (err) {
        setError(err.message || "Sign-in failed");
      }
    };

    finish();
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
