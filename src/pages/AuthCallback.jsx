import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { useAuth } from "@/lib/AuthContext";
import { completeOAuthFromUrl, hasPendingOAuthParams } from "@/lib/oauthBootstrap";
import { supabase } from "@/api/supabaseClient";

function friendlyAuthError(message) {
  if (/code verifier|pkce|flow state|invalid.*code/i.test(message || "")) {
    return "Google sign-in could not finish (login session expired). Close extra tabs, then tap Continue with Google again from this same browser.";
  }
  return message || "Sign-in failed";
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const { checkUserAuth } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const finish = async () => {
      try {
        if (hasPendingOAuthParams()) {
          const result = await completeOAuthFromUrl();
          if (!result.ok) {
            if (!cancelled) setError(friendlyAuthError(result.error));
            return;
          }
        } else {
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          if (!data.session) {
            throw new Error("No session returned. Try again or use email login.");
          }
        }

        // Drop oauth query params from the address bar after a successful exchange
        if (typeof window !== "undefined" && window.history?.replaceState) {
          window.history.replaceState({}, document.title, "/");
        }

        // Log new OAuth signups (created in the last 10 minutes)
        try {
          const { data: userData } = await supabase.auth.getUser();
          const u = userData?.user;
          if (u?.email) {
            const createdMs = u.created_at ? new Date(u.created_at).getTime() : 0;
            const isNew = createdMs && Date.now() - createdMs < 10 * 60 * 1000;
            if (isNew) {
              await fetch("/api/signup-emails", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: u.email,
                  fullName: u.user_metadata?.full_name || u.user_metadata?.name || "",
                  source: "oauth",
                }),
              });
            }
          }
        } catch {
          /* ignore */
        }

        await checkUserAuth();
        if (!cancelled) navigate("/", { replace: true });
      } catch (err) {
        if (!cancelled) setError(friendlyAuthError(err.message));
      }
    };

    finish();
    return () => {
      cancelled = true;
    };
  }, [navigate, checkUserAuth]);

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
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" aria-hidden="true" />
        </div>
      )}
    </AuthLayout>
  );
}
