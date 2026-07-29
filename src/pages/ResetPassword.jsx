import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) setReady(true);
      setChecking(false);
    };

    /** @param {string} event */
    function handleAuthStateChange(event) {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
        setChecking(false);
      }
    }

    const { data: subscription } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    checkSession();
    return () => subscription.subscription.unsubscribe();
  }, []);

  /** @param {React.FormEvent<HTMLFormElement>} e */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await supabase.auth.updateUser({ password: newPassword });
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <AuthLayout title="Loading" subtitle="Preparing password reset">
        <div className="flex justify-center py-6">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AuthLayout>
    );
  }

  if (!ready) {
    return (
      <AuthLayout title="Invalid reset link" subtitle="This link is missing or expired">
        <p className="mb-4 text-center text-sm text-muted-foreground">
          Open the reset link from your email, or request a new password reset.
        </p>
        <p className="text-center text-sm">
          <Link to="/forgot-password" className="font-semibold text-foreground hover:underline">
            Request a new link
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="New password" subtitle="Choose a new password for TitanOS">
      {error && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="password" className="font-medium text-foreground">
            New password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-12 w-full rounded-xl border border-border bg-background pl-10 text-foreground"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="confirm" className="font-medium text-foreground">
            Confirm password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-12 w-full rounded-xl border border-border bg-background pl-10 text-foreground"
              required
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Resetting...
            </>
          ) : (
            "Reset password"
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
