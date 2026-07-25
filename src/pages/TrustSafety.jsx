import React, { useCallback, useEffect, useState } from "react";
import { Ban, Flag, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import FeatureHonestyBanner from "@/components/shared/FeatureHonestyBanner";
import ComingSoonState from "@/components/shared/ComingSoonState";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import {
  REPORT_REASONS,
  blockUser,
  getTrustState,
  listBlockedUsers,
  submitUserReport,
  unblockUser,
} from "@/lib/trustSafetyApi";

function Card({ title, icon: Icon, children }) {
  return (
    <section className="glass rounded-2xl border border-border p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-titan-cyan/10 text-titan-cyan grid place-items-center">
          <Icon className="w-4 h-4" aria-hidden="true" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function TrustSafety() {
  const { user, isLoadingAuth, authChecked } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState("");
  const [blocks, setBlocks] = useState([]);
  const [reportForm, setReportForm] = useState({
    targetId: "",
    targetName: "",
    reason: REPORT_REASONS[0],
    details: "",
  });

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setLoadError(false);
    try {
      await getTrustState(user);
      setBlocks(listBlockedUsers(user.id));
    } catch {
      setLoadError(true);
      toast({ variant: "destructive", title: "Couldn't load Trust & Safety" });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authChecked && user?.id) load();
  }, [authChecked, user?.id, load]);

  const withBusy = async (key, fn) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast({ variant: "destructive", title: err?.message || "Action failed" });
    } finally {
      setBusy("");
    }
  };

  if (!authChecked || isLoadingAuth) {
    return <PageLoader variant="list" label="Loading Trust & Safety" />;
  }

  if (!user?.id) {
    return (
      <div className="page-pad max-w-3xl mx-auto pb-24">
        <PageHeader title="Trust & Safety" subtitle="Reporting and blocking for your account" />
        <EmptyState
          title="Sign in for Trust & Safety"
          description="Report and block tools require an account."
          actionLabel="Sign in"
          onAction={() => {
            window.location.href = "/login";
          }}
        />
      </div>
    );
  }

  if (loading) {
    return <PageLoader variant="list" label="Loading Trust & Safety" />;
  }

  if (loadError) {
    return <ErrorState title="Couldn't load Trust & Safety" onRetry={load} />;
  }

  return (
    <div className="relative page-pad max-w-3xl mx-auto pb-32 space-y-4">
      <div className="relative space-y-4">
        <PageHeader
          eyebrow="Account · Coming soon"
          title="Trust & Safety"
          subtitle="Identity verification and 2FA providers are not live yet. Reporting and blocking work on this account."
        />

        <FeatureHonestyBanner>
          Phone SMS, authenticator 2FA, document review, and fraud scoring are not production-ready. Those
          controls were removed so nothing looks verified when it isn&apos;t. Report and block lists save for
          your account now.
        </FeatureHonestyBanner>

        <ComingSoonState
          title="Identity verification coming soon"
          description="Email confirmation, SMS phone checks, ID/insurance review, and login 2FA need real providers before they can be offered as live controls."
          primaryTo="/settings"
          primaryLabel="Open Settings"
        />

        <Card title="Report a user" icon={Flag}>
          <p className="text-xs text-muted-foreground">
            Submit a report for Moderation review. Include the user ID when you have it.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            <Input
              value={reportForm.targetName}
              onChange={(e) => setReportForm((f) => ({ ...f, targetName: e.target.value }))}
              placeholder="User display name"
              className="rounded-xl bg-muted"
              aria-label="User display name"
            />
            <Input
              value={reportForm.targetId}
              onChange={(e) => setReportForm((f) => ({ ...f, targetId: e.target.value }))}
              placeholder="User ID"
              className="rounded-xl bg-muted"
              aria-label="User ID"
            />
          </div>
          <select
            value={reportForm.reason}
            onChange={(e) => setReportForm((f) => ({ ...f, reason: e.target.value }))}
            className="w-full h-10 px-3 rounded-xl bg-muted border border-border text-sm"
            aria-label="Report reason"
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
            aria-label="Report details"
          />
          <Button
            className="rounded-xl min-h-[44px]"
            disabled={busy === "report" || !reportForm.targetId.trim()}
            onClick={() =>
              withBusy("report", async () => {
                await submitUserReport(user, reportForm);
                setReportForm({
                  targetId: "",
                  targetName: "",
                  reason: REPORT_REASONS[0],
                  details: "",
                });
                toast({ title: "Report submitted" });
              })
            }
          >
            Submit report
          </Button>
        </Card>

        <Card title="Blocked users" icon={Ban}>
          <p className="text-xs text-muted-foreground mb-2">
            Blocked users won&apos;t appear in your messaging recommendations on this device.
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            <Input
              id="block-id"
              placeholder="User ID to block"
              className="rounded-xl bg-muted max-w-xs"
              aria-label="User ID to block"
            />
            <Input
              id="block-name"
              placeholder="Name (optional)"
              className="rounded-xl bg-muted max-w-[160px]"
              aria-label="Display name"
            />
            <Button
              variant="outline"
              className="rounded-xl min-h-[44px]"
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
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <span>
                    {b.target_name || "User"}{" "}
                    <span className="text-xs text-muted-foreground font-mono">{b.target_id}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-xl min-h-[40px]"
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
          <Shield className="w-5 h-5 text-titan-cyan shrink-0" aria-hidden="true" />
          <p>
            When verification providers go live, this page will show real status and enforce 2FA at sign-in.
            Until then, only report and block tools are interactive.
          </p>
        </div>
      </div>
    </div>
  );
}
