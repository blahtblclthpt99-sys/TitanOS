import React from "react";
import { AlertTriangle, CheckCircle2, Loader2, MessageCircle, ShieldCheck } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { disputeEngagementEvent, getEngagementSnapshot } from "@/lib/engagementApi";

function statusLabel(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function when(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? new Date(time).toLocaleString() : "Unknown time";
}

function responseLabel(hours) {
  if (!Number.isFinite(Number(hours))) return "Not enough data";
  const value = Number(hours);
  if (value < 1) return `${Math.max(1, Math.round(value * 60))} min`;
  if (value < 24) return `${value.toFixed(value < 10 ? 1 : 0)} hr`;
  return `${(value / 24).toFixed(1)} days`;
}

export default function Engagement() {
  const [state, setState] = React.useState({ loading: true, data: null, error: "" });
  const [disputeId, setDisputeId] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setState((old) => ({ ...old, loading: true, error: "" }));
    try {
      const data = await getEngagementSnapshot();
      setState({ loading: false, data, error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error?.message || "Could not load Engagement." });
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const submitDispute = async (event) => {
    event.preventDefault();
    if (!disputeId || saving) return;
    if (reason.trim().length < 3) {
      toast({ variant: "destructive", title: "Explain what is incorrect" });
      return;
    }
    setSaving(true);
    try {
      await disputeEngagementEvent(disputeId, reason.trim());
      toast({ title: "Interaction disputed", description: "That event is neutral in Engagement while the dispute is unresolved." });
      setDisputeId("");
      setReason("");
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't submit dispute", description: error?.message || "Try again." });
    } finally {
      setSaving(false);
    }
  };

  if (state.loading && !state.data) {
    return <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />Loading Engagement…</div>;
  }

  const data = state.data;
  return (
    <PageShell maxWidth="lg" className="space-y-6">
      <PageHeader
        eyebrow="Trust & Transparency"
        title="Your Engagement"
        subtitle="See the Titan interactions used to estimate communication behavior. You can challenge an incorrect interaction here."
      />

      {state.error ? <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{state.error}</div> : null}

      {data ? (
        <>
          <section className="titan-surface p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><MessageCircle className="h-5 w-5" aria-hidden="true" /></span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Engagement</p>
                  <h2 className="mt-1 text-2xl font-bold text-foreground">{data.probability == null ? "New to Titan" : `${data.probability}%`}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{data.probability == null ? "Not enough attributable history for an estimate" : "Estimated response probability"} · {data.confidence?.label || "New"}</p>
                </div>
              </div>
              <span className="rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground">{data.sampleSize || 0} attributable interactions</span>
            </div>

            <div className="mt-4 flex gap-3 rounded-xl border border-warning/25 bg-warning/5 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-muted-foreground">{data.policy?.warning || "Engagement is informational. It does not measure ability, qualifications, job performance, or hiring suitability."}</p>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="titan-surface p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Responses</p><p className="mt-2 text-xl font-bold tabular-nums text-foreground">{data.stats?.responded || 0}</p></div>
            <div className="titan-surface p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Typical response</p><p className="mt-2 text-xl font-bold text-foreground">{responseLabel(data.stats?.typicalResponseHours)}</p></div>
            <div className="titan-surface p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Confirmations</p><p className="mt-2 text-xl font-bold tabular-nums text-foreground">{data.stats?.interviewConfirmations || 0}</p></div>
            <div className="titan-surface p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Attendance</p><p className="mt-2 text-xl font-bold tabular-nums text-foreground">{data.stats?.interviewAttendance || 0}</p></div>
          </section>

          <section className="titan-surface p-5">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h2 className="font-semibold text-foreground">What does not hurt Engagement</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Declining an opportunity, saying you are not interested, negotiating compensation, or communicating an appropriate cancellation/reschedule is not punished. Technical issues, disputes, mutual changes, and counterparty-caused events are neutral.</p>
              </div>
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="engagement-events-heading">
            <div><h2 id="engagement-events-heading" className="text-lg font-semibold text-foreground">Interaction records</h2><p className="text-xs text-muted-foreground">These records are the source data. The percentage is derived and can change as recent behavior replaces older behavior.</p></div>
            {data.events?.length ? data.events.map((item) => (
              <article key={item.id} className="titan-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-foreground">{statusLabel(item.interaction_type)}</p>{item.disputed ? <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-warning">Disputed · neutral</span> : null}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{statusLabel(item.status)} · {statusLabel(item.attribution)} attribution · {when(item.occurred_at)}</p>
                  </div>
                  {!item.disputed ? <Button type="button" size="sm" variant="outline" onClick={() => { setDisputeId(item.id); setReason(""); }}>Report incorrect interaction</Button> : <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Challenge submitted</span>}
                </div>
                {disputeId === item.id ? (
                  <form onSubmit={submitDispute} className="mt-4 space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                    <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">What is incorrect about this interaction?</span><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} /></label>
                    <div className="flex gap-2"><Button type="submit" size="sm" disabled={saving}>{saving ? "Submitting…" : "Submit dispute"}</Button><Button type="button" size="sm" variant="ghost" onClick={() => { setDisputeId(""); setReason(""); }}>Cancel</Button></div>
                  </form>
                ) : null}
              </article>
            )) : <EmptyState icon={MessageCircle} title="No Engagement history yet" description="New users are shown as New to Titan—not 0%. Interaction history only begins when attributable Titan business/opportunity communications occur." />}
          </section>
        </>
      ) : null}
    </PageShell>
  );
}
