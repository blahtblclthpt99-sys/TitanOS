import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { BriefcaseBusiness, CalendarClock, CheckCircle2, ChevronRight, Clock3, Save, Sparkles } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import NativeSelect from "@/components/shared/NativeSelect";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { safeExternalJobUrl } from "@/lib/jobSearchCommand";
import { listMyJobMatchInteractions, saveMyCareerPipelineDetails, setMyJobMatchInteraction } from "@/lib/jobMatchInteractionsApi";

const STAGES = ["saved", "applied", "screening", "interview", "offer", "hired", "closed"];
const ACTIVE_STAGES = ["applied", "screening", "interview", "offer"];

function stageLabel(stage) {
  return String(stage || "saved").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function nextStage(stage) {
  const index = STAGES.indexOf(stage);
  if (index < 0 || index >= STAGES.length - 1) return null;
  return STAGES[index + 1];
}

function localDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function draftFromRow(row) {
  return {
    interviewAt: localDateTime(row.interview_at),
    followUpAt: localDateTime(row.follow_up_at),
    notes: row.private_notes || "",
  };
}

export default function CareerPipeline() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = (await listMyJobMatchInteractions(user.id)).filter((row) => row.state !== "ignored");
      setRows(data);
      setDrafts(Object.fromEntries(data.map((row) => [row.id, draftFromRow(row)])));
    } catch {
      toast({ variant: "destructive", title: "Couldn't load career pipeline", description: "Please try again." });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => Object.fromEntries(STAGES.map((stage) => [stage, rows.filter((row) => row.state === stage).length])), [rows]);
  const activeCount = ACTIVE_STAGES.reduce((sum, stage) => sum + (counts[stage] || 0), 0);

  const updateStage = async (row, state) => {
    if (!user?.id || !state || busyId) return;
    setBusyId(row.id);
    try {
      const updated = await setMyJobMatchInteraction(user.id, {
        source: row.source,
        source_name: row.source_name,
        source_job_id: row.source_job_id,
        external_id: row.source_job_id,
        id: row.source_job_id,
        source_url: row.source_url,
      }, state);
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, ...updated, state } : item));
      toast({ title: `Moved to ${stageLabel(state)}` });
    } catch {
      toast({ variant: "destructive", title: "Couldn't update application stage", description: "Please try again." });
    } finally {
      setBusyId(null);
    }
  };

  const saveDetails = async (row) => {
    if (!user?.id || busyId) return;
    const draft = drafts[row.id] || draftFromRow(row);
    setBusyId(row.id);
    try {
      const updated = await saveMyCareerPipelineDetails(user.id, row.id, draft);
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, ...updated } : item));
      setDrafts((current) => ({ ...current, [row.id]: draftFromRow(updated) }));
      toast({ title: "Application details saved" });
    } catch (error) {
      const message = /valid date and time/i.test(String(error?.message || ""))
        ? error.message
        : "Please review the dates and try again.";
      toast({ variant: "destructive", title: "Couldn't save application details", description: message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageShell maxWidth="xl" className="space-y-6">
      <PageHeader eyebrow="Career" title="Career pipeline" subtitle="Track every opportunity from saved job through interview, offer and hire. You control every status change." />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="titan-surface p-4"><p className="text-xs text-muted-foreground">Active applications</p><p className="mt-1 text-2xl font-bold">{activeCount}</p></div>
        <div className="titan-surface p-4"><p className="text-xs text-muted-foreground">Interviews</p><p className="mt-1 text-2xl font-bold">{counts.interview || 0}</p></div>
        <div className="titan-surface p-4"><p className="text-xs text-muted-foreground">Offers</p><p className="mt-1 text-2xl font-bold">{counts.offer || 0}</p></div>
        <div className="titan-surface p-4"><p className="text-xs text-muted-foreground">Hired</p><p className="mt-1 text-2xl font-bold">{counts.hired || 0}</p></div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button asChild><Link to="/jobs">Find jobs</Link></Button>
        <Button asChild variant="outline"><Link to="/assistant?mode=interview"><Sparkles className="mr-2 h-4 w-4" />Interview prep</Link></Button>
        <Button type="button" variant="outline" onClick={load} disabled={loading}>Refresh</Button>
      </div>

      {loading ? (
        <div className="titan-surface p-6 text-sm text-muted-foreground" role="status">Loading your applications…</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={BriefcaseBusiness} title="No applications tracked yet" description="Save a job or track an application from Jobs and it will appear here." actionLabel="Browse jobs" onAction={() => window.location.assign("/jobs")} />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => {
            const next = nextStage(row.state);
            const draft = drafts[row.id] || draftFromRow(row);
            const originalListingUrl = row.source === "external" ? safeExternalJobUrl(row) : null;
            return (
              <article key={row.id} className="titan-surface p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">{stageLabel(row.state)}</p>
                    <h2 className="mt-1 truncate text-base font-semibold text-foreground">{row.source_name || "Opportunity"}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Job reference: {row.source_job_id}</p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                </div>

                {originalListingUrl ? <a href={originalListingUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">Open original listing</a> : row.source === "external" ? <p className="text-xs text-muted-foreground">Original listing link unavailable. Verify the employer before continuing.</p> : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5"><span className="flex items-center gap-1 text-xs font-semibold"><CalendarClock className="h-3.5 w-3.5" />Interview</span><Input type="datetime-local" value={draft.interviewAt} onChange={(e) => setDrafts((current) => ({ ...current, [row.id]: { ...draft, interviewAt: e.target.value } }))} /></label>
                  <label className="space-y-1.5"><span className="flex items-center gap-1 text-xs font-semibold"><Clock3 className="h-3.5 w-3.5" />Follow-up</span><Input type="datetime-local" value={draft.followUpAt} onChange={(e) => setDrafts((current) => ({ ...current, [row.id]: { ...draft, followUpAt: e.target.value } }))} /></label>
                </div>

                <label className="space-y-1.5"><span className="text-xs font-semibold">Private notes</span><Textarea maxLength={5000} value={draft.notes} onChange={(e) => setDrafts((current) => ({ ...current, [row.id]: { ...draft, notes: e.target.value } }))} placeholder="Recruiter name, interview details, questions to ask, next steps…" /></label>

                <Button type="button" variant="outline" className="w-full gap-2" disabled={busyId === row.id} onClick={() => saveDetails(row)}><Save className="h-4 w-4" />Save interview & notes</Button>

                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <NativeSelect value={row.state} onChange={(e) => updateStage(row, e.target.value)} disabled={busyId === row.id} aria-label="Application stage">
                    {STAGES.map((stage) => <option key={stage} value={stage}>{stageLabel(stage)}</option>)}
                  </NativeSelect>
                  {next ? <Button type="button" disabled={busyId === row.id} onClick={() => updateStage(row, next)}>Move to {stageLabel(next)}<ChevronRight className="ml-1 h-4 w-4" /></Button> : null}
                </div>

                <p className="text-[11px] text-muted-foreground">These notes and dates are private to your account and are not used to rank you for employers or make employment decisions.</p>
              </article>
            );
          })}
        </section>
      )}
    </PageShell>
  );
}
