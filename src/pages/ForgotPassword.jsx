import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/apiClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.auth.resetPasswordRequest(email);
    } catch {
      // Always show success
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <AuthLayout title="Reset password" subtitle="We'll email you a reset link">
      {sent ? (
        <p className="text-sm text-slate-600 text-center leading-relaxed">
          If an account exists with that email, you'll receive a password reset link shortly.
        </p>
      ) : (
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
                className="pl-10 h-12 rounded-xl bg-slate-50/50 border-slate-200 text-slate-900"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send reset link"
            )}
          </button>
        </form>
      )}
      <p className="mt-5 text-center text-sm text-slate-500">
        <Link to="/login" className="font-semibold text-slate-800 hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
