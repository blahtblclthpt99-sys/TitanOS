import React, { useEffect, useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "@/api/apiClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import SocialAuthButtons from "@/components/auth/SocialAuthButtons";
import { useAuth } from "@/lib/AuthContext";
import { consumeReturnTo, resolveReturnTo } from "@/lib/returnTo";
import { hasCachedAuthSession } from "@/lib/sessionPeek";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { checkUserAuth, isAuthenticated, authChecked, isLoadingAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const sessionRecover = Boolean(location.state?.sessionRecover);
  const recoverAttempted = useRef(false);

  const returnTo = resolveReturnTo(location);

  useEffect(() => {
    if (authChecked && isAuthenticated) {
      navigate(consumeReturnTo(returnTo), { replace: true });
    }
  }, [authChecked, isAuthenticated, navigate, returnTo]);

  // Recover soft sessions (tokens present, profile load failed) instead of bouncing to Landing.
  useEffect(() => {
    if (recoverAttempted.current) return;
    if (!sessionRecover && !hasCachedAuthSession()) return;
    if (isAuthenticated || isLoadingAuth) return;
    if (!authChecked) return;
    if (!hasCachedAuthSession()) return;
    recoverAttempted.current = true;
    checkUserAuth().catch(() => {});
  }, [sessionRecover, authChecked, isAuthenticated, isLoadingAuth, checkUserAuth]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.auth.loginViaEmailPassword(email, password);
      await checkUserAuth();
      // Navigate via the isAuthenticated effect so the shell gate sees auth=true
      // in the same render as `/` (avoids a one-frame Landing flash → loop feel).
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome to TitanOS" subtitle="Sign in to continue">
      {sessionRecover && !isAuthenticated && (
        <div className="mb-4 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground" role="status">
          Your session couldn’t be restored. Sign in again to get back into the app.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      <SocialAuthButtons onError={setError} returnTo={returnTo} />

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
          <span className="bg-card px-3 text-muted-foreground">OR</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="font-medium text-foreground">
            Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 pl-10"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="font-medium text-foreground">
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 pl-10"
              required
            />
          </div>
        </div>
        <Button type="submit" disabled={loading} className="h-12 w-full">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-between text-sm text-muted-foreground">
        <Link to="/forgot-password" className="transition-colors hover:text-foreground focus-ring rounded-md">
          Forgot password?
        </Link>
        <Link
          to="/register"
          state={location.state}
          className="transition-colors hover:text-foreground focus-ring rounded-md"
        >
          Need an account? <span className="font-semibold text-foreground">Sign up</span>
        </Link>
      </div>
    </AuthLayout>
  );
}
