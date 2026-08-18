import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { useAuth } from "@/lib/AuthContext";
import { completeOAuthFromUrl, hasPendingOAuthParams } from "@/lib/oauthBootstrap";
import { supabase } from "@/api/supabaseClient";
import { api } from "@/api/apiClient";
import { accountHomePath } from "@/lib/accountExperience";
import { consumeReturnTo } from "@/lib/returnTo";

const OAUTH_EXCHANGE_TIMEOUT_MS = 15000;
const PROFILE_BOOT_TIMEOUT_MS = 12000;

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function friendlyAuthError(message) {
  if (/code verifier|pkce|flow state|invalid.*code/i.test(message || "")) {
    return "Google sign-in could not finish (login session expired). Close extra tabs, then tap Continue with Google again from this same browser.";
  }
  return message || "Sign-in failed";
}

function readPendingAccountType() {
  try {
    const value = sessionStorage.getItem("titanos_pending_account_type") || "";
    return value === "business" || value === "job_seeker" ? value : "";
  } catch {
    return "";
  }
}

function clearPendingAccountType() {
  try {
    sessionStorage.removeItem("titanos_pending_account_type");
  } catch {
    /* ignore */
  }
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
          const result = await withTimeout(
            completeOAuthFromUrl(),
            OAUTH_EXCHANGE_TIMEOUT_MS,
            "Google sign-in took too long to return. Check your connection and try again."
          );
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

        if (typeof window !== "undefined" && window.history?.replaceState) {
          window.history.replaceState({}, document.title, "/auth/callback");
        }

        // Preserve the Job Seeker / Business choice made before OAuth. This
        // server endpoint cannot change subscription entitlements.
        const pendingAccountType = readPendingAccountType();
        if (pendingAccountType) {
          await api.functions.invoke("setAccountType", { account_type: pendingAccountType });
          clearPendingAccountType();
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
                  source: pendingAccountType ? `oauth:${pendingAccountType}` : "oauth",
                }),
              });
            }
          }
        } catch {
          /* ignore */
        }

        await withTimeout(
          checkUserAuth(),
          PROFILE_BOOT_TIMEOUT_MS,
          "Your account signed in, but profile setup took too long. Tap retry to continue."
        );
        const me = await api.auth.me().catch(() => null);
        const dest = consumeReturnTo(accountHomePath(me));
        if (!cancelled) navigate(dest, { replace: true });
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
            Retry sign in
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
