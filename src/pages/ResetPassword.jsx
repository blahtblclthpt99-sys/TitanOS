import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/api/apiClient";
import { supabase } from "@/api/supabaseClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
        setChecking(false);
      }
    });

    checkSession();
    return () => subscription.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await api.auth.resetPassword({ newPassword });
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <AuthLayout title="Loading" subtitle="Preparing password reset">
        <div className="flex justify-center py-6">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      </AuthLayout>
    );
  }

  if (!ready) {
    return (
      <AuthLayout title="Invalid reset link" subtitle="This link is missing or expired">
        <p className="text-sm text-slate-600 text-center mb-4">
          Open the reset link from your email, or request a new password reset.
        </p>
        <p className="text-center text-sm">
          <Link to="/forgot-password" className="font-semibold text-slate-800 hover:underline">
            Request a new link
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="New password" subtitle="Choose a new password for TitanOS">
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-700 font-medium">
            New password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pl-10 h-12 rounded-xl bg-slate-50/50 border-slate-200 text-slate-900"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm" className="text-slate-700 font-medium">
            Confirm password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12 rounded-xl bg-slate-50/50 border-slate-200 text-slate-900"
              required
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-foreground text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
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
