import React from "react";
import { ChevronDown, Flag, MessageCircle, ShieldAlert } from "lucide-react";
import { disputeEngagementEvent, getEngagementSnapshot } from "@/lib/engagementApi";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

function hours(value) {
  if (!Number.isFinite(Number(value))) return "Not enough data";
  const n = Number(value);
  if (n < 1) return `${Math.max(1, Math.round(n * 60))} min`;
  if (n < 24) return `${n.toFixed(n < 10 ? 1 : 0)} hr`;
  return `${(n / 24).toFixed(1)} days`;
}

function activeLabel(value) {
  if (!value) return "No recent interaction";
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "Unknown";
  const days = Math.max(0, Math.floor((Date.now() - ms) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(ms).toLocaleDateString();
}

function eventLabel(event = {}) {
  const type = String(event.interaction_type || "interaction").replaceAll("_", " ");
  const status = String(event.status || "recorded").replaceAll("_", " ");
  return `${type} · ${status}`;
}

/**
 * This component intentionally owns the mandatory warning. Do not extract the
 * percentage into a badge without the warning/context; Engagement is not a
 * hiring-quality or eligibility signal.
 */
export default function EngagementSignal({ subjectUserId, opportunityId, snapshot = undefined, compact = false }) {
  const hasProvidedSnapshot = snapshot !== undefined;
  const [state, setState] = React.useState({ loading: !hasProvidedSnapshot, data: snapshot || null, error: "" });
  const [disputing, setDisputing] = React.useState("");

  const reload = React.useCallback(async () => {
    if (!subjectUserId) return null;
    const data = await getEngagementSnapshot({ subjectUserId, opportunityId });
    setState({ loading: false, data, error: "" });
    return data;
  }, [subjectUserId, opportunityId]);

  React.useEffect(() => {
    let alive = true;
    if (hasProvidedSnapshot) {
      setState({ loading: false, data: snapshot || null, error: "" });
      return () => { alive = false; };
    }
    if (!subjectUserId) {
      setState({ loading: false, data: null, error: "" });
      return () => { alive = false; };
    }
    setState({ loading: true, data: null, error: "" });
    getEngagementSnapshot({ subjectUserId, opportunityId })
      .then((data) => { if (alive) setState({ loading: false, data, error: "" }); })
      .catch((error) => { if (alive) setState({ loading: false, data: null, error: error?.message || "Unavailable" }); });
    return () => { alive = false; };
  }, [subjectUserId, opportunityId, snapshot, hasProvidedSnapshot]);

  const dispute = async (event) => {
    if (!event?.id || disputing) return;
    const reason = window.prompt("What is incorrect about this Titan interaction record?");
    if (reason == null) return;
    const cleanReason = reason.trim();
    if (cleanReason.length < 3) {
      toast({ variant: "destructive", title: "Add a little more detail", description: "Please explain the issue in at least 3 characters." });
      return;
    }

    setDisputing(event.id);
    try {
      await disputeEngagementEvent(event.id, cleanReason);
      toast({ title: "Interaction disputed", description: "Titan will treat this event as neutral while the dispute is unresolved." });
      if (!hasProvidedSnapshot) await reload();
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't submit dispute", description: error?.message || "Try again." });
    } finally {
      setDisputing("");
    }
  };

  if (state.loading) {
    return <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">Loading Engagement…</div>;
  }
  if (!state.data) {
    return state.error ? <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">Engagement unavailable.</div> : null;
  }

  const data = state.data;
  const score = data.probability;
  const confidence = data.confidence?.label || "New to Titan";
  const warning = data.policy?.warning || "Engagement is informational and is not a measure of qualifications or hiring suitability.";
  const ownEvents = data.own && Array.isArray(data.events) ? data.events : [];

  return (
    <section className="rounded-xl border border-border bg-muted/15 p-3" aria-label="Engagement information">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><MessageCircle className="h-4 w-4" aria-hidden="true" /></span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Engagement</p>
            <p className="mt-0.5 font-semibold text-foreground">{score == null ? "New to Titan" : `${score}% estimated response probability`}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{confidence}{data.sampleSize ? ` · ${data.sampleSize} attributable interactions` : ""}</p>
          </div>
        </div>
      </div>

      <div className={`mt-3 flex gap-2 rounded-lg border border-warning/25 bg-warning/5 ${compact ? "p-2.5" : "p-3"}`}>
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">{warning}</p>
      </div>

      {!compact ? (
        <details className="mt-3 group">
          <summary className="flex min-h-[40px] cursor-pointer list-none items-center justify-between gap-2 rounded-md px-2 text-xs font-semibold text-foreground hover:bg-muted/30 focus-ring">
            Why this Engagement signal?
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background/40 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Responses recorded</p><p className="mt-1 font-bold tabular-nums text-foreground">{data.stats?.responded || 0}</p></div>
            <div className="rounded-lg border border-border bg-background/40 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Typical response</p><p className="mt-1 font-bold text-foreground">{hours(data.stats?.typicalResponseHours)}</p></div>
            <div className="rounded-lg border border-border bg-background/40 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Interview confirmations</p><p className="mt-1 font-bold tabular-nums text-foreground">{data.stats?.interviewConfirmations || 0}</p></div>
            <div className="rounded-lg border border-border bg-background/40 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last positive interaction</p><p className="mt-1 font-bold text-foreground">{activeLabel(data.stats?.lastActiveAt)}</p></div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Declining an opportunity, saying “not interested,” or communicating an appropriate cancellation/reschedule does not lower Engagement. Disputed, technical, mutual, and counterparty-caused events are neutral.</p>

          {data.own ? (
            <div className="mt-4 border-t border-border pt-3">
              <p className="text-xs font-semibold text-foreground">Interaction records used by Titan</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">You can challenge an incorrect record. The raw event stays auditable, but a disputed event is neutral while the dispute is unresolved.</p>
              {ownEvents.length ? (
                <div className="mt-3 space-y-2">
                  {ownEvents.map((event) => (
                    <div key={event.id} className="flex flex-col gap-2 rounded-lg border border-border bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold capitalize text-foreground">{eventLabel(event)}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{event.occurred_at ? new Date(event.occurred_at).toLocaleString() : "Time unavailable"}{event.disputed ? " · disputed / neutral" : ""}</p>
                      </div>
                      {!event.disputed ? (
                        <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={Boolean(disputing)} onClick={() => dispute(event)}>
                          <Flag className="h-3.5 w-3.5" aria-hidden="true" />{disputing === event.id ? "Submitting…" : "Report incorrect interaction"}
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : <p className="mt-3 text-xs text-muted-foreground">No attributable Titan interaction history yet.</p>}
            </div>
          ) : null}
        </details>
      ) : null}
    </section>
  );
}
