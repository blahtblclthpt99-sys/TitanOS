import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  Flag,
  Loader2,
  Lock,
  Mail,
  Phone,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Car,
  FileText,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import {
  REPORT_REASONS,
  VERIFY_TYPES,
  beginTwoFactorSetup,
  blockUser,
  confirmPhoneVerification,
  confirmTwoFactor,
  disableTwoFactor,
  getTrustState,
  listBlockedUsers,
  markEmailVerified,
  runFraudCheck,
  sendEmailVerification,
  startPhoneVerification,
  submitDocumentVerification,
  submitUserReport,
  totpCode,
  unblockUser,
  verificationSummary,
} from "@/lib/trustSafetyApi";

const STATUS_STYLE = {
  verified: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  rejected: "bg-red-500/15 text-red-600",
  unverified: "bg-muted text-muted-foreground",
};

const ICONS = {
  email: Mail,
  phone: Phone,
  identity: UserCheck,
  driver_license: Car,
  insurance: FileText,
};

function StatusPill({ status }) {
  return (
    <span className={`text-[11px] font-semibold rounded-full px-2.5 py-1 capitalize ${STATUS_STYLE[status] || STATUS_STYLE.unverified}`}>
      {status || "unverified"}
    </span>
  );
}

function Card({ title, icon: Icon, children, status }) {
  return (
    <section className="glass rounded-2xl border border-border p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-titan-cyan/10 text-titan-cyan grid place-items-center">
            <Icon className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        {status && <StatusPill status={status} />}
      </div>
      {children}
    </section>
  );
}

export default function TrustSafety() {
  const { user, isLoadingAuth, authChecked } = useAuth();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [demoPhoneCode, setDemoPhoneCode] = useState("");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaSetup, setTwoFaSetup] = useState(null);
  const [docUrl, setDocUrl] = useState({ identity: "", driver_license: "", insurance: "" });
  const [insuranceMeta, setInsuranceMeta] = useState({ carrier: "", policy_number: "", expires_at: "" });
  const [dlMeta, setDlMeta] = useState({ number_last4: "", back_url: "" });
  const [blocks, setBlocks] = useState([]);
  const [reportForm, setReportForm] = useState({ targetId: "", targetName: "", reason: REPORT_REASONS[0], details: "" });

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setLoadError(false);
    try {
      runFraudCheck(user.id);
      const s = await getTrustState(user);
      setState(s);
      setBlocks(listBlockedUsers(user.id));
      setPhone(s.phone?.phone || user.phone || "");
    } catch {
      setLoadError(true);
      toast({ variant: "destructive", title: "Couldn't load trust center" });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authChecked && user?.id) load();
  }, [authChecked, user?.id, load]);

  const summary = useMemo(() => verificationSummary(state || {}), [state]);
  const fraud = state?.fraud || { score: 0, level: "low", flags: [] };

  const withBusy = async (key, fn) => {
    setBusy(key);
    try {
      await fn();
      setState(await getTrustState(user));
    } catch (err) {
      toast({ variant: "destructive", title: err?.message || "Action failed" });
    } finally {
      setBusy("");
    }
  };

  if (!authChecked || isLoadingAuth || loading) {
    return <PageLoader variant="list" label="Loading Trust & Safety" />;
  }

  if (loadError || !state) {
    return <ErrorState title="Couldn't load Trust & Safety" onRetry={load} />;
  }

  return (
    <div className="relative page-pad max-w-3xl mx-auto pb-32 space-y-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 -right-16 w-80 h-80 rounded-full bg-titan-cyan/8 blur-[100px]" />
      </div>

      <div className="relative space-y-4">
        <PageHeader
          title="Trust & Safety"
          subtitle="Verification, two-factor auth, fraud signals, reports, and blocking"
        />

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="glass rounded-2xl border border-border p-4">
            <p className="text-xs text-muted-foreground">Verified</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {summary.verified}/{summary.total}
            </p>
          </div>
          <div className="glass rounded-2xl border border-border p-4">
            <p className="text-xs text-muted-foreground">Two-factor</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {summary.twoFactor ? "On" : "Off"}
            </p>
          </div>
          <div className="glass rounded-2xl border border-border p-4">
            <p className="text-xs text-muted-foreground">Fraud risk</p>
            <p className="text-2xl font-bold text-foreground mt-1 capitalize">
              {fraud.level || "low"}
              <span className="text-sm font-medium text-muted-foreground ml-2">{fraud.score}/100</span>
            </p>
          </div>
        </div>

        {/* Email */}
        <Card title="Email verification" icon={Mail} status={state.email?.status}>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="rounded-xl bg-titan-cyan text-black hover:bg-titan-cyan/90"
              disabled={busy === "email" || state.email?.status === "verified"}
              onClick={() =>
                withBusy("email", async () => {
                  await sendEmailVerification(user);
                  toast({ title: "Verification email sent", description: "Check your inbox for a code or link." });
                })
              }
            >
              {busy === "email" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send verification"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              disabled={state.email?.status === "verified"}
              onClick={() =>
                withBusy("email-mark", async () => {
                  await markEmailVerified(user.id);
                  toast({ title: "Email marked verified" });
                })
              }
            >
              Mark verified
            </Button>
          </div>
        </Card>

        {/* Phone */}
        <Card title="Phone verification" icon={Phone} status={state.phone?.status}>
          <div className="grid sm:grid-cols-[1fr_auto] gap-2">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 555 0100"
              className="rounded-xl bg-muted"
              disabled={state.phone?.status === "verified"}
            />
            <Button
              className="rounded-xl bg-titan-cyan text-black hover:bg-titan-cyan/90"
              disabled={busy === "phone-send" || state.phone?.status === "verified"}
              onClick={() =>
                withBusy("phone-send", async () => {
                  const { demoCode } = await startPhoneVerification(user, phone);
                  setDemoPhoneCode(demoCode);
                  toast({ title: "Code sent", description: "Enter the 6-digit code below." });
                })
              }
            >
              {busy === "phone-send" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send code"}
            </Button>
          </div>
          {state.phone?.status === "pending" && (
            <div className="space-y-2">
              {demoPhoneCode && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Demo code (also in Notifications): <strong>{demoPhoneCode}</strong>
                </p>
              )}
              <div className="flex gap-2">
                <Input
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  placeholder="6-digit code"
                  className="rounded-xl bg-muted max-w-[160px]"
                />
                <Button
                  className="rounded-xl"
                  disabled={busy === "phone-confirm"}
                  onClick={() =>
                    withBusy("phone-confirm", async () => {
                      await confirmPhoneVerification(user, phoneCode);
                      setPhoneCode("");
                      toast({ title: "Phone verified" });
                    })
                  }
                >
                  Confirm
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Document verifications */}
        {["identity", "driver_license", "insurance"].map((type) => {
          const meta = VERIFY_TYPES.find((t) => t.id === type);
          const Icon = ICONS[type];
          return (
            <Card key={type} title={meta.label} icon={Icon} status={state[type]?.status}>
              <p className="text-xs text-muted-foreground">{meta.description}</p>
              <Input
                value={docUrl[type] || ""}
                onChange={(e) => setDocUrl((d) => ({ ...d, [type]: e.target.value }))}
                placeholder="Document image URL"
                className="rounded-xl bg-muted"
              />
              {type === "driver_license" && (
                <div className="grid sm:grid-cols-2 gap-2">
                  <Input
                    value={dlMeta.back_url}
                    onChange={(e) => setDlMeta((m) => ({ ...m, back_url: e.target.value }))}
                    placeholder="Back image URL"
                    className="rounded-xl bg-muted"
                  />
                  <Input
                    value={dlMeta.number_last4}
                    onChange={(e) => setDlMeta((m) => ({ ...m, number_last4: e.target.value.slice(0, 4) }))}
                    placeholder="Last 4 of license #"
                    className="rounded-xl bg-muted"
                  />
                </div>
              )}
              {type === "insurance" && (
                <div className="grid sm:grid-cols-3 gap-2">
                  <Input
                    value={insuranceMeta.carrier}
                    onChange={(e) => setInsuranceMeta((m) => ({ ...m, carrier: e.target.value }))}
                    placeholder="Carrier"
                    className="rounded-xl bg-muted"
                  />
                  <Input
                    value={insuranceMeta.policy_number}
                    onChange={(e) => setInsuranceMeta((m) => ({ ...m, policy_number: e.target.value }))}
                    placeholder="Policy #"
                    className="rounded-xl bg-muted"
                  />
                  <Input
                    type="date"
                    value={insuranceMeta.expires_at}
                    onChange={(e) => setInsuranceMeta((m) => ({ ...m, expires_at: e.target.value }))}
                    className="rounded-xl bg-muted"
                  />
                </div>
              )}
              <Button
                size="sm"
                className="rounded-xl bg-titan-cyan text-black hover:bg-titan-cyan/90"
                disabled={busy === type || !docUrl[type]}
                onClick={() =>
                  withBusy(type, async () => {
                    const payload =
                      type === "identity"
                        ? { document_url: docUrl.identity }
                        : type === "driver_license"
                          ? {
                              front_url: docUrl.driver_license,
                              back_url: dlMeta.back_url,
                              number_last4: dlMeta.number_last4,
                            }
                          : {
                              document_url: docUrl.insurance,
                              ...insuranceMeta,
                            };
                    await submitDocumentVerification(user, type, payload);
                    toast({ title: "Submitted for review", description: "An admin will verify your document." });
                  })
                }
              >
                {busy === type ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit for verification"}
              </Button>
            </Card>
          );
        })}

        {/* 2FA */}
        <Card
          title="Two-factor authentication"
          icon={Smartphone}
          status={state.two_factor?.enabled ? "verified" : "unverified"}
        >
          <p className="text-xs text-muted-foreground">
            Use a time-based authenticator code when signing in to sensitive actions.
          </p>
          {!state.two_factor?.enabled && !twoFaSetup && (
            <Button
              className="rounded-xl bg-titan-cyan text-black hover:bg-titan-cyan/90"
              disabled={busy === "2fa-start"}
              onClick={() =>
                withBusy("2fa-start", async () => {
                  const setup = await beginTwoFactorSetup(user);
                  setTwoFaSetup(setup);
                })
              }
            >
              <Lock className="w-4 h-4 mr-1.5" /> Enable 2FA
            </Button>
          )}
          {twoFaSetup && !state.two_factor?.enabled && (
            <div className="space-y-2 rounded-xl border border-border p-3 bg-muted/40">
              <p className="text-xs font-semibold">Secret key</p>
              <code className="text-sm tracking-widest text-titan-cyan break-all">{twoFaSetup.secret}</code>
              <p className="text-xs text-muted-foreground">
                Current demo code: <strong>{totpCode(twoFaSetup.secret)}</strong> (rotates every 30s)
              </p>
              <p className="text-xs text-muted-foreground">Save recovery codes offline:</p>
              <div className="grid grid-cols-2 gap-1 text-[11px] font-mono">
                {twoFaSetup.codes.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Input
                  value={twoFaCode}
                  onChange={(e) => setTwoFaCode(e.target.value)}
                  placeholder="Enter code"
                  className="rounded-xl bg-background max-w-[140px]"
                />
                <Button
                  className="rounded-xl"
                  disabled={busy === "2fa-confirm"}
                  onClick={() =>
                    withBusy("2fa-confirm", async () => {
                      await confirmTwoFactor(user, twoFaCode);
                      setTwoFaSetup(null);
                      setTwoFaCode("");
                      toast({ title: "2FA enabled" });
                    })
                  }
                >
                  Confirm
                </Button>
              </div>
            </div>
          )}
          {state.two_factor?.enabled && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
                <ShieldCheck className="w-4 h-4" /> Enabled
              </span>
              <Input
                value={twoFaCode}
                onChange={(e) => setTwoFaCode(e.target.value)}
                placeholder="Code to disable"
                className="rounded-xl bg-muted max-w-[140px]"
              />
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={busy === "2fa-off"}
                onClick={() =>
                  withBusy("2fa-off", async () => {
                    await disableTwoFactor(user, twoFaCode);
                    setTwoFaCode("");
                    toast({ title: "2FA disabled" });
                  })
                }
              >
                Disable
              </Button>
            </div>
          )}
        </Card>

        {/* Fraud */}
        <Card title="Fraud detection" icon={ShieldAlert} status={fraud.level === "elevated" ? "rejected" : fraud.level === "watch" ? "pending" : "verified"}>
          <p className="text-sm text-muted-foreground">
            Risk score <strong className="text-foreground">{fraud.score}</strong> · level{" "}
            <strong className="text-foreground capitalize">{fraud.level}</strong>
          </p>
          {(fraud.flags || []).length ? (
            <ul className="space-y-1.5">
              {fraud.flags.map((f) => (
                <li key={f.id} className="text-xs rounded-xl border border-border px-3 py-2 flex justify-between gap-2">
                  <span>{f.label}</span>
                  <span className="uppercase text-[10px] font-semibold text-muted-foreground">{f.severity}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No active fraud signals.</p>
          )}
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              runFraudCheck(user.id);
              load();
              toast({ title: "Fraud check refreshed" });
            }}
          >
            Re-run check
          </Button>
        </Card>

        {/* Report */}
        <Card title="Report system" icon={Flag}>
          <p className="text-xs text-muted-foreground">Report a user for review by Trust & Safety / Moderation.</p>
          <div className="grid sm:grid-cols-2 gap-2">
            <Input
              value={reportForm.targetName}
              onChange={(e) => setReportForm((f) => ({ ...f, targetName: e.target.value }))}
              placeholder="User display name"
              className="rounded-xl bg-muted"
            />
            <Input
              value={reportForm.targetId}
              onChange={(e) => setReportForm((f) => ({ ...f, targetId: e.target.value }))}
              placeholder="User ID"
              className="rounded-xl bg-muted"
            />
          </div>
          <select
            value={reportForm.reason}
            onChange={(e) => setReportForm((f) => ({ ...f, reason: e.target.value }))}
            className="w-full h-10 px-3 rounded-xl bg-muted border border-border text-sm"
          >
            {REPORT_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <Textarea
            rows={3}
            value={reportForm.details}
            onChange={(e) => setReportForm((f) => ({ ...f, details: e.target.value }))}
            placeholder="Details"
            className="rounded-xl bg-muted"
          />
          <Button
            className="rounded-xl bg-titan-cyan text-black hover:bg-titan-cyan/90"
            disabled={busy === "report" || !reportForm.targetId}
            onClick={() =>
              withBusy("report", async () => {
                await submitUserReport(user, reportForm);
                setReportForm({ targetId: "", targetName: "", reason: REPORT_REASONS[0], details: "" });
                toast({ title: "Report submitted" });
              })
            }
          >
            Submit report
          </Button>
        </Card>

        {/* Blocking */}
        <Card title="Blocking system" icon={Ban}>
          <p className="text-xs text-muted-foreground mb-2">
            Blocked users can&apos;t message you or appear in your recommendations.
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            <Input
              id="block-id"
              placeholder="User ID to block"
              className="rounded-xl bg-muted max-w-xs"
            />
            <Input id="block-name" placeholder="Name (optional)" className="rounded-xl bg-muted max-w-[160px]" />
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={async () => {
                const idEl = document.getElementById("block-id");
                const nameEl = document.getElementById("block-name");
                const tid = idEl?.value?.trim();
                if (!tid) return toast({ variant: "destructive", title: "Enter a user ID" });
                await blockUser(user.id, tid, nameEl?.value || "");
                if (idEl) idEl.value = "";
                if (nameEl) nameEl.value = "";
                setBlocks(listBlockedUsers(user.id));
                toast({ title: "User blocked" });
              }}
            >
              Block user
            </Button>
          </div>
          {blocks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No blocked users.</p>
          ) : (
            <ul className="space-y-2">
              {blocks.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                  <span>
                    {b.target_name || "User"}{" "}
                    <span className="text-xs text-muted-foreground font-mono">{b.target_id}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-xl"
                    onClick={async () => {
                      await unblockUser(user.id, b.target_id);
                      setBlocks(listBlockedUsers(user.id));
                    }}
                  >
                    Unblock
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="rounded-2xl border border-border bg-muted/30 p-4 flex gap-3 text-sm text-muted-foreground">
          <Shield className="w-5 h-5 text-titan-cyan shrink-0" />
          <p>
            Completing email, phone, and 2FA lowers your fraud risk score. Document checks go to Moderation for
            review. Use Reports for abuse; Blocking is private to your account.
          </p>
        </div>
      </div>
    </div>
  );
}
