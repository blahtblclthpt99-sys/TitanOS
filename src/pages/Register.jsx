import React, { useState } from "react";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BriefcaseBusiness, Building2, CheckCircle2, Mail, Lock, Loader2, User } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import SocialAuthButtons from "@/components/auth/SocialAuthButtons";
import { toast } from "@/components/ui/use-toast";
import { attachReferralOnSignup } from "@/lib/referralApi";
import { useAuth } from "@/lib/AuthContext";
import { consumeReturnTo, resolveReturnTo } from "@/lib/returnTo";
import { isFeatureEnabled } from "@/lib/featureFlags";

const ACCOUNT_CHOICES = [
  {
    id: "job_seeker",
    title: "Job Seeker",
    description: "See nearby jobs immediately and improve matches with your skills and qualifications.",
    icon: BriefcaseBusiness,
  },
  {
    id: "business",
    title: "Business",
    description: "Run jobs, customers, money, employees, fleet, inventory, and recruiting in TitanOS.",
    icon: Building2,
  },
];

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const { checkUserAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const referralsLive = isFeatureEnabled("referrals");
  const refCode = referralsLive ? searchParams.get("ref") || "" : "";
  const returnTo = resolveReturnTo(location);
  const [accountType, setAccountType] = useState(searchParams.get("type") === "business" ? "business" : "job_seeker");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const accountHome = accountType === "business" ? "/" : "/hire/matches";

  const finishSignup = async (userId) => {
    if (refCode) {
      try {
        await api.auth.updateMe({ referred_by_code: refCode });
      } catch {
        /* columns may not exist until migration */
      }
      await attachReferralOnSignup({ userId, email, refCode });
    }
    await checkUserAuth();
    const explicitReturn = returnTo && returnTo !== "/" ? returnTo : accountHome;
    navigate(consumeReturnTo(explicitReturn), { replace: true });
  };

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
      const result = await api.auth.register({
        email,
        password,
        fullName: fullName.trim(),
        accountType,
      });
      if (result?.session) {
        const me = await api.auth.me().catch(() => null);
        await finishSignup(me?.id || result?.user?.id);
        return;
      }
      if (result?.verificationMode === "email_link" || result?.needsEmailVerification) {
        setError("");
        toast({
          title: "Check your email",
          description: `Confirm your address, then sign in to your ${accountType === "business" ? "Business" : "Job Seeker"} workspace.`,
        });
        navigate("/login", { replace: true });
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
      const me = await api.auth.me().catch(() => null);
      await finishSignup(me?.id);
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
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {error}
          </div>
        )}
        <div className="flex justify-center mb-6">
          <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button type="button" className="h-12 w-full" onClick={handleVerify} disabled={loading || otpCode.length < 6}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Verifying...</> : "Verify"}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Didn't receive the code?{" "}
          <button type="button" onClick={handleResend} className="font-semibold text-foreground hover:underline">Resend</button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your TitanOS account" subtitle="Choose the workspace built for what you actually need to do">
      <div className="mb-5 grid grid-cols-2 gap-2" aria-label="Choose account type">
        {ACCOUNT_CHOICES.map((choice) => {
          const Icon = choice.icon;
          const selected = accountType === choice.id;
          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => setAccountType(choice.id)}
              aria-pressed={selected}
              className={`rounded-xl border p-3 text-left transition-colors focus-ring ${selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <Icon className={`h-5 w-5 ${selected ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
                {selected ? <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" /> : null}
              </div>
              <p className="mt-2 text-sm font-semibold text-foreground">{choice.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{choice.description}</p>
            </button>
          );
        })}
      </div>

      {refCode ? (
        <p className="mb-4 text-xs text-center text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
          Referral code applied: <span className="font-mono font-semibold">{refCode}</span>
        </p>
      ) : null}
      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</div>
      )}

      <SocialAuthButtons onError={setError} returnTo={accountHome} accountType={accountType} />

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-[11px] uppercase tracking-wider"><span className="bg-card px-3 text-muted-foreground">OR</span></div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName" className="font-medium text-foreground">Full name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="fullName" type="text" autoComplete="name" placeholder="Alex Rivera" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-12 pl-10" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="font-medium text-foreground">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 pl-10" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="font-medium text-foreground">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 pl-10" minLength={8} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm" className="font-medium text-foreground">Confirm password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="confirm" type="password" autoComplete="new-password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-12 pl-10" minLength={8} required />
          </div>
        </div>
        <Button type="submit" disabled={loading} className="h-12 w-full">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Creating account...</> : `Create ${accountType === "business" ? "Business" : "Job Seeker"} account`}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-muted-foreground leading-relaxed px-1">
        The account type controls your TitanOS workspace, not your paid subscription. By creating an account, you agree to our{" "}
        <Link to="/terms" className="font-medium text-foreground underline underline-offset-2">Terms of Service</Link>{" "}
        and <Link to="/privacy-policy" className="font-medium text-foreground underline underline-offset-2">Privacy Policy</Link>.
      </p>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" state={location.state} className="font-semibold text-foreground hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
