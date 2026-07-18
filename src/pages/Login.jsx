import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/api/apiClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import SocialAuthButtons from "@/components/auth/SocialAuthButtons";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.auth.loginViaEmailPassword(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome to TitanOS" subtitle="Sign in to continue">
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100" role="alert">
          {error}
        </div>
      )}

      <SocialAuthButtons onError={setError} />

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
          <span className="bg-white px-3 text-slate-400">OR</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-700 font-medium">
            Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12 rounded-xl bg-slate-50/50 border-slate-200 text-slate-900 placeholder:text-slate-400"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-700 font-medium">
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12 rounded-xl bg-slate-50/50 border-slate-200 text-slate-900 placeholder:text-slate-400"
              required
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
        <Link to="/forgot-password" className="hover:text-slate-800 transition-colors">
          Forgot password?
        </Link>
        <Link to="/register" className="hover:text-slate-800 transition-colors">
          Need an account? <span className="font-semibold text-slate-800">Sign up</span>
        </Link>
      </div>
    </AuthLayout>
  );
}
