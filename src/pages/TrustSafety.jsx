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
import { getTrustState } from "@/lib/trustSafetyApi";
import {
  REPORT_REASONS,
  blockUser,
  listBlockedUsers,
  submitUserReport,
  unblockUser,
} from "@/lib/ugcSafetyApi";

function Card({ title, icon: Icon, children }) {
  return (
    <section className="titan-surface border border-border p-4 sm:p-5 space-y-3">
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
  const [blockId, setBlockId] = useState("");
  const [blockName, setBlockName] = useState("");
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
      setBlocks(await listBlockedUsers(user.id));
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

  if (!authChecked || isLoadingAuth) return <PageLoader variant="list" label="Loading Trust & Safety" />;

  if (!user?.id) {
    return (
      <div className="page-pad max-w-3xl mx-auto pb-24">
        <PageHeader title="Trust & Safety" subtitle="Reporting and blocking for your account" />
        <EmptyState
          title="Sign in for Trust & Safety"
          description="Report and block tools require an account."
          actionLabel="Sign in"
          onAction={() => { window.location.href = "/login"; }}
        />
      </div>
    );
  }

  if (loading) return <PageLoader variant="list" label="Loading Trust & Safety" />;
  if (loadError) return <ErrorState title="Couldn't load Trust & Safety" onRetry={load} />;

  return (
    <div className="relative page-pad max-w-3xl mx-auto pb-32 space-y-4">
      <PageHeader
        eyebrow="Account"
        title="Trust & Safety"
        subtitle="Report harmful behavior and control who can interact with you."
      />

      <FeatureHonestyBanner>
        Reporting and blocking are live and sync with your TitanOS account. Identity verification, SMS phone
        checks, authenticator 2FA, and document review still require production providers before they can be
        offered as verified controls.
      </FeatureHonestyBanner>

      <ComingSoonState
        title="Identity verification coming soon"
        description="Email confirmation, SMS phone checks, ID/insurance review, and login 2FA need real providers before they can be offered as live controls."
        primaryTo="/settings"
        primaryLabel="Open Settings"
      />

      <Card title="Report a user" icon={Flag}>
        <p className="text-xs text-muted-foreground">
          Reports are sent to TitanOS moderation. Include the user ID and enough detail to review the issue.
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
          {REPORT_REASONS.map((reason) => <option key={reason}>{reason}</option>)}
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
          onClick={() => withBusy("report", async () => {
            await submitUserReport(user, reportForm);
            setReportForm({ targetId: "", targetName: "", reason: REPORT_REASONS[0], details: "" });
            toast({ title: "Report submitted for moderation" });
          })}
        >
          Submit report
        </Button>
      </Card>

      <Card title="Blocked users" icon={Ban}>
        <p className="text-xs text-muted-foreground mb-2">
          Blocking is account-wide. New direct messages are rejected in either direction until you unblock the user.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          <Input
            value={blockId}
            onChange={(e) => setBlockId(e.target.value)}
            placeholder="User ID to block"
            className="rounded-xl bg-muted max-w-xs"
            aria-label="User ID to block"
          />
          <Input
            value={blockName}
            onChange={(e) => setBlockName(e.target.value)}
            placeholder="Name (optional)"
            className="rounded-xl bg-muted max-w-[160px]"
            aria-label="Display name"
          />
          <Button
            variant="outline"
            className="rounded-xl min-h-[44px]"
            disabled={busy === "block" || !blockId.trim()}
            onClick={() => withBusy("block", async () => {
              await blockUser(user.id, blockId.trim(), blockName.trim());
              setBlockId("");
              setBlockName("");
              setBlocks(await listBlockedUsers(user.id));
              toast({ title: "User blocked" });
            })}
          >
            Block user
          </Button>
        </div>
        {blocks.length === 0 ? (
          <p className="text-xs text-muted-foreground">No blocked users.</p>
        ) : (
          <ul className="space-y-2">
            {blocks.map((block) => (
              <li key={block.id} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                <span>
                  {block.target_name || "User"}{" "}
                  <span className="text-xs text-muted-foreground font-mono">{block.target_id}</span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-xl min-h-[40px]"
                  disabled={busy === `unblock:${block.target_id}`}
                  onClick={() => withBusy(`unblock:${block.target_id}`, async () => {
                    await unblockUser(user.id, block.target_id);
                    setBlocks(await listBlockedUsers(user.id));
                  })}
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
        <p>Reports are retained for moderation and blocks are enforced server-side for direct-message creation.</p>
      </div>
    </div>
  );
}
