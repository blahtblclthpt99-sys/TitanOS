import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, LifeBuoy, MessageCircle, RefreshCw, Send, UserRound, Wrench } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/api/apiClient";
import { WORKSPACE_LABELS } from "@/lib/accountExperience";
import { subscribeToSupportCase } from "@/lib/supportApi";

const STATUS = {
  NEW: "New", AI_WORKING: "AI working", NEEDS_USER: "Needs user", HUMAN_AGENT: "Human agent",
  ENGINEERING: "Engineering", RESOLVED: "Resolved", CLOSED: "Closed",
};

function workspaceLabel(value) {
  return WORKSPACE_LABELS[value] || "General";
}

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function SupportCommandCenter() {
  const [inbox, setInbox] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [reply, setReply] = useState("");
  const [nextStatus, setNextStatus] = useState("NEEDS_USER");
  const [statusFilter, setStatusFilter] = useState("all");
  const [workspaceFilter, setWorkspaceFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadInbox = useCallback(async () => {
    setError("");
    try {
      const result = await api.functions.invoke("supportAgentInbox", {});
      setInbox(result);
      setSelectedId((current) => current || result.cases?.[0]?.id || null);
    } catch (err) {
      setError(Number(err?.status) === 403 ? "This account does not have Titan Support staff access." : err?.message || "Support Command Center could not load.");
    }
  }, []);

  const reloadCase = useCallback(async () => {
    if (!selectedId) return;
    const result = await api.functions.invoke("supportAgentGetCase", { case_id: selectedId });
    setDetail(result);
    await loadInbox();
  }, [selectedId, loadInbox]);

  useEffect(() => { loadInbox(); }, [loadInbox]);
  useEffect(() => {
    if (!selectedId) { setDetail(null); return undefined; }
    let cancelled = false;
    api.functions.invoke("supportAgentGetCase", { case_id: selectedId })
      .then((result) => { if (!cancelled) setDetail(result); })
      .catch((err) => { if (!cancelled) setError(err?.message || "Assigned case could not be opened."); });
    return () => { cancelled = true; };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return undefined;
    let cancelled = false;
    let refreshTimer = null;
    const unsubscribe = subscribeToSupportCase(selectedId, () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        if (cancelled) return;
        reloadCase().catch((err) => {
          if (!cancelled) setError(err?.message || "Live staff update could not be loaded.");
        });
      }, 150);
    });
    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      unsubscribe();
    };
  }, [selectedId, reloadCase]);

  const sendReply = async () => {
    if (!selectedId || !reply.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.functions.invoke("supportAgentReply", { case_id: selectedId, message: reply.trim(), status: nextStatus });
      setReply("");
      await reloadCase();
    } catch (err) {
      setError(err?.message || "Support reply could not be saved.");
    } finally { setBusy(false); }
  };

  const filteredCases = useMemo(() => {
    const all = inbox?.cases || [];
    return all.filter((item) => {
      const statusMatch = statusFilter === "all" || item.status === statusFilter;
      const workspaceMatch = workspaceFilter === "all" || (item.workspace || "general") === workspaceFilter;
      const categoryMatch = categoryFilter === "all" || item.category === categoryFilter;
      const priorityMatch = priorityFilter === "all" || item.priority === priorityFilter;
      return statusMatch && workspaceMatch && categoryMatch && priorityMatch;
    });
  }, [inbox?.cases, statusFilter, workspaceFilter, categoryFilter, priorityFilter]);

  const categories = useMemo(
    () => [...new Set((inbox?.cases || []).map((item) => item.category).filter(Boolean))].sort(),
    [inbox?.cases]
  );

  if (error && !inbox) return <ErrorState title="Support Command Center unavailable" description={error} onRetry={loadInbox} />;
  if (!inbox) return <PageLoader label="Loading Titan Support Command Center" />;

  const stats = [
    ["Open", inbox.stats.open, LifeBuoy], ["Urgent", inbox.stats.urgent, AlertTriangle],
    ["AI working", inbox.stats.ai_working, Bot], ["Human", inbox.stats.human, UserRound],
    ["Engineering", inbox.stats.engineering, Wrench], ["Waiting", inbox.stats.waiting, MessageCircle],
  ];

  return (
    <PageShell maxWidth="xl" className="space-y-5">
      <PageHeader eyebrow="Restricted · Titan Support staff" title="Support Command Center" subtitle="Assigned cases, workspace context, escalations, diagnostics, engineering handoff, and resolution history." actions={<Button type="button" variant="outline" className="min-h-[44px] gap-2" onClick={loadInbox}><RefreshCw className="h-4 w-4" /> Refresh</Button>} />
      {error ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{stats.map(([label, value, Icon]) => <div key={label} className="titan-surface p-4"><Icon className="h-5 w-5 text-primary" /><p className="mt-3 text-2xl font-bold text-foreground">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>)}</div>

      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <section className="titan-surface overflow-hidden" aria-label="Support ticket queue">
          <div className="border-b border-border p-4">
            <h2 className="font-semibold text-foreground">Tickets</h2>
            <p className="text-xs text-muted-foreground">Role: {inbox.role}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <select aria-label="Filter support tickets by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="min-h-[40px] rounded-md border border-border bg-background px-2 text-xs text-foreground">
                <option value="all">All statuses</option>
                {Object.entries(STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select aria-label="Filter support tickets by workspace" value={workspaceFilter} onChange={(e) => setWorkspaceFilter(e.target.value)} className="min-h-[40px] rounded-md border border-border bg-background px-2 text-xs text-foreground">
                <option value="all">All workspaces</option>
                <option value="general">General</option>
                <option value="job_seeker">Job Seeker</option>
                <option value="self_employed">Independent Work</option>
                <option value="business">Business</option>
              </select>
              <select aria-label="Filter support tickets by category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="min-h-[40px] rounded-md border border-border bg-background px-2 text-xs text-foreground">
                <option value="all">All categories</option>
                {categories.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
              </select>
              <select aria-label="Filter support tickets by priority" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="min-h-[40px] rounded-md border border-border bg-background px-2 text-xs text-foreground">
                <option value="all">All priorities</option>
                {["P0","P1","P2","P3","P4"].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
          </div>
          <div className="max-h-[680px] overflow-y-auto">{filteredCases.length ? filteredCases.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full border-b border-border p-4 text-left focus-ring ${selectedId === item.id ? "bg-primary/5" : "hover:bg-muted/50"}`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{item.case_number} · {item.title}</p><p className="mt-1 text-xs text-muted-foreground">{workspaceLabel(item.workspace)} · {item.category.replaceAll("_", " ")} · {STATUS[item.status] || item.status}</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${["P0","P1"].includes(item.priority) ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{item.priority}</span></div></button>) : <p className="p-8 text-center text-sm text-muted-foreground">No tickets match these filters.</p>}</div>
        </section>

        <section className="titan-surface overflow-hidden" aria-label="Selected support ticket">
          {!detail ? <p className="p-8 text-center text-sm text-muted-foreground">Select a ticket.</p> : <>
            <div className="border-b border-border p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{detail.case.case_number}</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">{detail.case.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{workspaceLabel(detail.case.workspace)} · {detail.case.category.replaceAll("_", " ")} · {STATUS[detail.case.status] || detail.case.status} · {detail.case.priority}</p>
              <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <p>Case ID: <span className="break-all text-foreground">{detail.case.id}</span></p>
                <p>User ID: <span className="break-all text-foreground">{detail.case.created_by_id}</span></p>
                <p>Created: <span className="text-foreground">{formatTime(detail.case.created_at)}</span></p>
                <p>First response: <span className="text-foreground">{formatTime(detail.case.first_response_at)}</span></p>
                <p>Last updated: <span className="text-foreground">{formatTime(detail.case.updated_at)}</span></p>
              </div>
            </div>
            {detail.diagnostics?.length ? <div className="border-b border-border bg-muted/30 p-4"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Sanitized diagnostics · consent recorded</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 text-xs text-foreground">{JSON.stringify(detail.diagnostics[0].payload, null, 2)}</pre></div> : null}
            <div className="max-h-[420px] space-y-3 overflow-y-auto p-5">{detail.messages.map((item) => <article key={item.id} className="rounded-lg border border-border p-3"><div className="flex justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{item.sender_kind.replaceAll("_", " ")}</p><time className="text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleString()}</time></div><p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{item.body}</p></article>)}</div>
            {detail.case.status !== "CLOSED" ? <div className="border-t border-border p-4"><Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Reply with a verified troubleshooting step or resolution…" /><div className="mt-3 flex flex-col gap-2 sm:flex-row"><select aria-label="Next support status" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} className="min-h-[44px] flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground"><option value="NEEDS_USER">Needs user</option><option value="HUMAN_AGENT">Human agent</option><option value="ENGINEERING">Engineering</option><option value="RESOLVED">Resolved</option></select><Button type="button" className="min-h-[44px] gap-2" onClick={sendReply} disabled={busy || !reply.trim()}><Send className="h-4 w-4" /> {busy ? "Saving…" : "Send reply"}</Button></div></div> : null}
          </>}
        </section>
      </div>
    </PageShell>
  );
}
