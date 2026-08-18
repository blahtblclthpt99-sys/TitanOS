import React, { useState } from "react";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BriefcaseBusiness, Building2, CheckCircle2, Hammer, Layers3, Mail, Lock, Loader2, User } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import SocialAuthButtons from "@/components/auth/SocialAuthButtons";
import { toast } from "@/components/ui/use-toast";
import { attachReferralOnSignup } from "@/lib/referralApi";
import { useAuth } from "@/lib/AuthContext";
import { consumeReturnTo, resolveReturnTo } from "@/lib/returnTo";
import { isFeatureEnabled } from "@/lib/featureFlags";

const WORKSPACE_OPTIONS = [
  {
    id: "job_seeker",
    title: "Find a Job",
    label: "Job Seeker",
    description: "Find employers looking for someone with my skills.",
    icon: BriefcaseBusiness,
  },
  {
    id: "self_employed",
    title: "Find Independent Work",
    label: "Independent Work",
    description: "Find customers and businesses needing services I can provide.",
    icon: Hammer,
  },
  {
    id: "business",
    title: "Run a Business",
    label: "Business",
    description: "Manage my company, customers, workers, jobs, money, and operations.",
    icon: Building2,
  },
];

const MODE_OPTIONS = [
  ...WORKSPACE_OPTIONS,
  {
    id: "multiple",
    title: "More than one",
    label: "Multiple workspaces",
    description: "Activate multiple Titan workspaces without mixing the interfaces.",
    icon: Layers3,
  },
];

function homeFor(workspace) {
  if (workspace === "business") return "/";
  if (workspace === "self_employed") return "/independent";
  return "/hire/matches";
}

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const { checkUserAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const referralsLive = isFeatureEnabled("referrals");
  const refCode = referralsLive ? searchParams.get("ref") || "" : "";
  const returnTo = resolveReturnTo(location);
  const requestedType = searchParams.get("type");
  const initialMode = ["job_seeker", "self_employed", "business"].includes(requestedType) ? requestedType : "job_seeker";
  const [mode, setMode] = useState(initialMode);
  const [enabledWorkspaces, setEnabledWorkspaces] = useState([initialMode]);
  const [activeWorkspace, setActiveWorkspace] = useState(initialMode);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const accountHome = homeFor(activeWorkspace);

  const chooseMode = (id) => {
    setMode(id);
    if (id === "multiple") {
      const next = enabledWorkspaces.length >= 2 ? enabledWorkspaces : ["job_seeker", "self_employed"];
      setEnabledWorkspaces(next);
      if (!next.includes(activeWorkspace)) setActiveWorkspace(next[0]);
      return;
    }
    setEnabledWorkspaces([id]);
    setActiveWorkspace(id);
  };

  const toggleWorkspace = (id) => {
    setEnabledWorkspaces((current) => {
      const exists = current.includes(id);
      if (exists && current.length <= 2) {
        toast({ title: "More than one requires at least two workspaces" });
        return current;
      }
      const next = exists ? current.filter((item) => item !== id) : [...current, id];
      if (!next.includes(activeWorkspace)) setActiveWorkspace(next[0]);
      return next;
    });
  };

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
    if (mode === "multiple" && enabledWorkspaces.length < 2) {
      setError("Choose at least two workspaces for More than one.");
      return;
    }
    if (!enabledWorkspaces.includes(activeWorkspace)) {
      setError("Choose an active workspace.");
      return;
    }
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
        enabledWorkspaces,
        activeWorkspace,
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
          description: `Confirm your address, then sign in. Your ${enabledWorkspaces.length > 1 ? "Titan workspaces are" : "Titan workspace is"} already saved.`,
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
      if (result?.access_token) await api.auth.setToken(result.access_token);
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
        {error ? <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</div> : null}
        <div className="mb-6 flex justify-center">
          <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
            <InputOTPGroup>{[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}</InputOTPGroup>
          </InputOTP>
        </div>
        <Button type="button" className="h-12 w-full" onClick={handleVerify} disabled={loading || otpCode.length < 6}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Verifying...</> : "Verify"}
        </Button>
        <p className="mt-4 text-center text-sm text-muted-foreground">Didn't receive the code? <button type="button" onClick={handleResend} className="font-semibold text-foreground hover:underline">Resend</button></p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your TitanOS account" subtitle="What are you looking to do?">
      <div className="mb-5 grid grid-cols-2 gap-2" aria-label="Choose how you work">
        {MODE_OPTIONS.map((choice) => {
          const Icon = choice.icon;
          const selected = mode === choice.id;
          return (
            <button key={choice.id} type="button" onClick={() => chooseMode(choice.id)} aria-pressed={selected} className={`rounded-xl border p-3 text-left transition-colors focus-ring ${selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"}`}>
              <div className="flex items-center justify-between gap-2"><Icon className={`h-5 w-5 ${selected ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />{selected ? <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" /> : null}</div>
              <p className="mt-2 text-sm font-semibold text-foreground">{choice.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{choice.description}</p>
            </button>
          );
        })}
      </div>

      {mode === "multiple" ? (
        <div className="mb-5 rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-sm font-semibold text-foreground">Enable your Titan workspaces</p>
          <p className="mt-1 text-xs text-muted-foreground">At least two. Only one interface is active at a time.</p>
          <div className="mt-3 space-y-2">
            {WORKSPACE_OPTIONS.map((choice) => {
              const checked = enabledWorkspaces.includes(choice.id);
              return (
                <div key={choice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
                  <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-foreground"><input type="checkbox" checked={checked} onChange={() => toggleWorkspace(choice.id)} className="h-4 w-4" />{choice.label}</label>
                  {checked ? <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="radio" name="activeWorkspace" checked={activeWorkspace === choice.id} onChange={() => setActiveWorkspace(choice.id)} />Start here</label> : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {refCode ? <p className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-center text-xs text-emerald-700">Referral code applied: <span className="font-mono font-semibold">{refCode}</span></p> : null}
      {error ? <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</div> : null}

      <SocialAuthButtons onError={setError} returnTo={accountHome} enabledWorkspaces={enabledWorkspaces} activeWorkspace={activeWorkspace} />

      <div className="relative my-5"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div><div className="relative flex justify-center text-[11px] uppercase tracking-wider"><span className="bg-card px-3 text-muted-foreground">OR</span></div></div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="fullName" className="font-medium text-foreground">Full name</Label><div className="relative"><User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="fullName" type="text" autoComplete="name" placeholder="Alex Rivera" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-12 pl-10" /></div></div>
        <div className="space-y-2"><Label htmlFor="email" className="font-medium text-foreground">Email</Label><div className="relative"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 pl-10" required /></div></div>
        <div className="space-y-2"><Label htmlFor="password" className="font-medium text-foreground">Password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 pl-10" minLength={8} required /></div></div>
        <div className="space-y-2"><Label htmlFor="confirm" className="font-medium text-foreground">Confirm password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="confirm" type="password" autoComplete="new-password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-12 pl-10" minLength={8} required /></div></div>
        <Button type="submit" disabled={loading} className="h-12 w-full">{loading ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Creating account...</> : enabledWorkspaces.length > 1 ? "Create TitanOS account" : `Create ${WORKSPACE_OPTIONS.find((item) => item.id === activeWorkspace)?.label || "TitanOS"} account`}</Button>
      </form>

      <p className="mt-4 px-1 text-center text-xs leading-relaxed text-muted-foreground">Workspace selection controls the TitanOS interface, not your paid subscription. By creating an account, you agree to our <Link to="/terms" className="font-medium text-foreground underline underline-offset-2">Terms of Service</Link> and <Link to="/privacy-policy" className="font-medium text-foreground underline underline-offset-2">Privacy Policy</Link>.</p>
      <p className="mt-5 text-center text-sm text-muted-foreground">Already have an account? <Link to="/login" state={location.state} className="font-semibold text-foreground hover:underline">Sign in</Link></p>
    </AuthLayout>
  );
}
