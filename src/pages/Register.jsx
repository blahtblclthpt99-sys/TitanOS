import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/api/apiClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, User } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import SocialAuthButtons from "@/components/auth/SocialAuthButtons";
import { toast } from "@/components/ui/use-toast";

export default function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const result = await api.auth.register({ email, password, fullName: fullName.trim() });
      if (result?.session) {
        navigate("/", { replace: true });
        return;
      }
      setShowOtp(true);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await api.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        await api.auth.setToken(result.access_token);
      }
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await api.auth.resendOtp(email);
      toast({ title: "Code sent", description: "Check your email for the new code." });
    } catch (err) {
      setError(err.message || "Failed to resend code");
    }
  };

  if (showOtp) {
    return (
      <AuthLayout title="Verify your email" subtitle={`We sent a code to ${email}`}>
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100" role="alert">
            {error}
          </div>
        )}
        <div className="flex justify-center mb-6">
          <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <button
          type="button"
          className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
          onClick={handleVerify}
          disabled={loading || otpCode.length < 6}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify"
          )}
        </button>
        <p className="text-center text-sm text-slate-500 mt-4">
          Didn't receive the code?{" "}
          <button type="button" onClick={handleResend} className="font-semibold text-slate-800 hover:underline">
            Resend
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your TitanOS account" subtitle="Free to start — upgrade later if you want">
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
          <Label htmlFor="fullName" className="text-slate-700 font-medium">
            Full name
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder="Alex Rivera"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="pl-10 h-12 rounded-xl bg-slate-50/50 border-slate-200 text-slate-900"
            />
          </div>
        </div>
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
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12 rounded-xl bg-slate-50/50 border-slate-200 text-slate-900"
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
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12 rounded-xl bg-slate-50/50 border-slate-200 text-slate-900"
              minLength={8}
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
              minLength={8}
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
              Creating account...
            </>
          ) : (
            "Create free account"
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-slate-800 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
