import React, { useEffect, useMemo, useState } from "react";
import { LifeBuoy, MessageCircle, Paperclip, RefreshCw, Send, ShieldCheck, UserRound, X } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/AuthContext";
import { activeWorkspace, WORKSPACE_LABELS, WORKSPACES } from "@/lib/accountExperience";
import {
  askTitanSupport,
  buildSupportDiagnosticEnvelope,
  createSupportCase,
  escalateSupportCase,
  getSupportCase,
  listSupportCases,
  postSupportMessage,
  reopenSupportCase,
  subscribeToSupportCase,
  submitSupportCsat,
  uploadSupportAttachment,
} from "@/lib/supportApi";
import { toast } from "@/components/ui/use-toast";

const SHARED_HELP = [
  ["Account & Login", "account"], ["Billing & Subscription", "billing"],
  ["TitanAUTO", "titan_auto"], ["Titan AI", "titan_ai"],
  ["Invisible Interface / 2nd Self", "invisible_interface"], ["Notifications", "notifications"],
  ["Communications", "communications"], ["Files", "files"], ["Android App", "android"],
  ["Web / PWA", "pwa"], ["Security", "security"], ["Technical Problems", "technical"],
];

const WORKSPACE_HELP = {
  [WORKSPACES.JOB_SEEKER]: [
    ["Find Jobs & Opportunities", "opportunities"], ["Job Seeker Profile", "profile"],
    ["Applications, Interviews & Responses", "applications"],
  ],
  [WORKSPACES.SELF_EMPLOYED]: [
    ["Independent Opportunities", "opportunities"], ["Service Profile", "independent_work"],
    ["Customers", "customers"], ["Scheduling", "scheduling"], ["Estimates & Quotes", "estimates"],
    ["Invoices", "invoices"], ["Money", "money"],
  ],
  [WORKSPACES.BUSINESS]: [
    ["Business OS", "business_os"], ["Jobs", "jobs"], ["Customers", "customers"], ["Scheduling", "scheduling"],
    ["Estimates", "estimates"], ["Invoices", "invoices"], ["Money", "money"], ["Recruiting & Talent", "recruiting"],
    ["Employees", "employees"], ["Fleet & Driver Hub", "fleet"], ["Inventory", "inventory"],
    ["Business Documents", "business_documents"], ["Lead Finder", "leads"],
  ],
};

const WORKSPACE_EXAMPLE = {
  [WORKSPACES.JOB_SEEKER]: "Example: Find Jobs keeps saying my session expired when I refresh…",
  [WORKSPACES.SELF_EMPLOYED]: "Example: My estimate did not convert into an invoice for this customer…",
  [WORKSPACES.BUSINESS]: "Example: A fleet job is not appearing on the schedule for my team…",
};

const STATUS_LABELS = {
  NEW: "New", AI_WORKING: "AI working", NEEDS_USER: "Needs you", HUMAN_AGENT: "Human agent",
  ENGINEERING: "Engineering", RESOLVED: "Resolved", CLOSED: "Closed",
};

function CaseStatus({ value }) {
  return <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">{STATUS_LABELS[value] || value}</span>;
}

function workspaceLabel(value) {
  return WORKSPACE_LABELS[value] || "General";
}

export default function SupportCenter() {
  const { user } = useAuth();
  const workspace = activeWorkspace(user);
  const currentWorkspaceLabel = workspaceLabel(workspace);
  const quickHelp = useMemo(() => [...(WORKSPACE_HELP[workspace] || []), ...SHARED_HELP], [workspace]);
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [category, setCategory] = useState("technical");
  const [problem, setProblem] = useState("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [diagnosticConsent, setDiagnosticConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [csatComment, setCsatComment] = useState("");

  const selectedCase = detail?.case || cases.find((item) => item.id === selectedCaseId) || null;
  const canEscalate = selectedCase && !["HUMAN_AGENT", "ENGINEERING", "RESOLVED", "CLOSED"].includes(selectedCase.status);
  const canSend = selectedCase && !["RESOLVED", "CLOSED"].includes(selectedCase.status);
  const canReopen = selectedCase && ["RESOLVED", "CLOSED"].includes(selectedCase.status);
  const showCsat = selectedCase && ["RESOLVED", "CLOSED"].includes(selectedCase.status) && !detail?.csat;

  const diagnostics = useMemo(() => buildSupportDiagnosticEnvelope({
    page: "Titan Support",
    feature: category,
    operation: "support_request",
    workspace,
  }), [category, workspace]);

  useEffect(() => {
    if (!quickHelp.some(([, value]) => value === category)) setCategory("technical");
  }, [quickHelp, category]);

  const refreshCases = async ({ preserveSelection = true } = {}) => {
    setLoading(true);
    setError("");
    try {
      const result = await listSupportCases();
      const next = result.cases || [];
      setCases(next);
      if (!preserveSelection || !selectedCaseId) setSelectedCaseId(next[0]?.id || null);
    } catch (err) {
      setError(err?.message || "Support cases could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshCases({ preserveSelection: false }); }, []);

  useEffect(() => {
    let cancelled = false;
    if (!selectedCaseId) { setDetail(null); return undefined; }
    getSupportCase(selectedCaseId)
      .then((result) => { if (!cancelled) setDetail(result); })
      .catch((err) => { if (!cancelled) setError(err?.message || "Support case could not be opened."); });
    return () => { cancelled = true; };
  }, [selectedCaseId]);

  useEffect(() => {
    if (!selectedCaseId) return undefined;
    let cancelled = false;
    let refreshTimer = null;
    const unsubscribe = subscribeToSupportCase(selectedCaseId, () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(async () => {
        try {
          const [caseResult, listResult] = await Promise.all([
            getSupportCase(selectedCaseId),
            listSupportCases(),
          ]);
          if (cancelled) return;
          setDetail(caseResult);
          setCases(listResult.cases || []);
        } catch (err) {
          if (!cancelled) setError(err?.message || "Live support update could not be loaded.");
        }
      }, 150);
    });
    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      unsubscribe();
    };
  }, [selectedCaseId]);

  const reloadDetail = async (caseId = selectedCaseId) => {
    if (!caseId) return;
    const result = await getSupportCase(caseId);
    setDetail(result);
    await refreshCases();
  };

  const handleCreate = async () => {
    const text = problem.trim();
    if (text.length < 3 || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await createSupportCase({
        title: text.slice(0, 90),
        description: text,
        category,
        workspace,
        source: "support_center",
        platform: diagnostics.platform,
        app_version: diagnostics.app_version,
        diagnostic_consent: diagnosticConsent,
        diagnostics: diagnosticConsent ? diagnostics : undefined,
      });
      const caseId = result.case.id;
      const followUpIssues = [];

      setProblem("");
      setAttachments([]);
      setDiagnosticConsent(false);
      setSelectedCaseId(caseId);

      if (attachments.length) {
        const uploadResults = await Promise.allSettled(
          attachments.map((file) => uploadSupportAttachment({ caseId, userId: user.id, file }))
        );
        const failedUploads = uploadResults.filter((item) => item.status === "rejected").length;
        if (failedUploads) followUpIssues.push(`${failedUploads} attachment${failedUploads === 1 ? "" : "s"} could not be attached.`);
      }

      if (result.warnings?.includes("diagnostics_not_attached")) {
        followUpIssues.push("Sanitized diagnostics could not be attached.");
      }

      try {
        await askTitanSupport(caseId, text, { appendCustomerMessage: false });
      } catch {
        followUpIssues.push("Titan Support AI could not reply yet; the case remains open.");
      }

      try {
        await reloadDetail(caseId);
      } catch {
        followUpIssues.push("The case was saved but could not be refreshed automatically.");
      }

      toast({
        title: `Support case ${result.case.case_number}`,
        description: followUpIssues.length ? "Case created. Some follow-up steps need attention." : "Titan Support has started troubleshooting.",
      });
      if (followUpIssues.length) setError(`Case ${result.case.case_number} was created. ${followUpIssues.join(" ")}`);
    } catch (err) {
      setError(err?.message || "Support case could not be created.");
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async () => {
    const text = message.trim();
    if (!text || !selectedCaseId || busy) return;
    setBusy(true);
    setError("");
    try {
      await postSupportMessage(selectedCaseId, text);
    } catch (err) {
      setError(err?.message || "Message could not be sent.");
      setBusy(false);
      return;
    }

    setMessage("");
    let aiError = null;
    try {
      await askTitanSupport(selectedCaseId, text, { appendCustomerMessage: false });
    } catch (err) {
      aiError = err;
    }

    try {
      await reloadDetail();
    } catch (err) {
      setError(aiError?.message || err?.message || "Your message was sent, but the conversation could not be refreshed automatically.");
      setBusy(false);
      return;
    }

    if (aiError) setError("Your message was sent. Titan Support AI could not reply yet, so the case remains available for human support.");
    setBusy(false);
  };

  const handleEscalate = async () => {
    if (!selectedCaseId || busy) return;
    setBusy(true);
    setError("");
    try {
      await escalateSupportCase(selectedCaseId);
      await reloadDetail();
      toast({ title: "Human support requested", description: "Your case history stays attached." });
    } catch (err) {
      setError(err?.message || "Human escalation could not be requested.");
    } finally { setBusy(false); }
  };

  const handleReopen = async () => {
    if (!selectedCaseId || busy) return;
    setBusy(true);
    setError("");
    try {
      await reopenSupportCase(selectedCaseId);
      await reloadDetail();
      toast({ title: "Support case reopened", description: "You can continue the existing conversation." });
    } catch (err) {
      setError(err?.message || "Support case could not be reopened.");
    } finally { setBusy(false); }
  };

  const handleCsat = async (solved) => {
    if (!selectedCaseId || busy) return;
    setBusy(true);
    try {
      await submitSupportCsat(selectedCaseId, { solved, comment: csatComment.trim() || undefined });
      setCsatComment("");
      await reloadDetail();
      toast({ title: "Thanks for the feedback" });
    } catch (err) {
      setError(err?.message || "Feedback could not be saved.");
    } finally { setBusy(false); }
  };

  return (
    <PageShell maxWidth="xl">
      <PageHeader
        title="Titan Support"
        subtitle={`Secure TitanOS troubleshooting for your ${currentWorkspaceLabel} workspace, with case history and human escalation when needed.`}
        eyebrow="Support"
        actions={<Button type="button" variant="outline" className="min-h-[44px] gap-2" onClick={() => refreshCases()} disabled={loading}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh</Button>}
      />

      {error ? <div role="alert" className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div> : null}

      <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]" aria-label="Create support case">
        <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><LifeBuoy className="h-5 w-5" aria-hidden="true" /></span>
            <div><h2 className="font-semibold text-foreground">How can we help?</h2><p className="text-sm text-muted-foreground">Current workspace: <span className="font-medium text-foreground">{currentWorkspaceLabel}</span>. Describe the exact problem and Titan Support will keep the case tied to that context.</p></div>
          </div>
          <label className="mb-2 block text-sm font-medium text-foreground" htmlFor="support-problem">Problem description</label>
          <Textarea id="support-problem" value={problem} onChange={(e) => setProblem(e.target.value)} rows={5} maxLength={10000} placeholder={WORKSPACE_EXAMPLE[workspace] || "Describe the exact TitanOS problem you are seeing…"} className="min-h-[132px]" />

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-foreground">Issue area</p>
            <div className="flex flex-wrap gap-2">
              {quickHelp.map(([label, value]) => (
                <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)} className={`min-h-[40px] rounded-full border px-3 py-2 text-xs font-semibold transition-colors focus-ring ${category === value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{label}</button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50">
              <Paperclip className="h-4 w-4" aria-hidden="true" /> Attach files
              <input type="file" multiple className="sr-only" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,text/csv,.docx,.xlsx,video/mp4" onChange={(e) => setAttachments(Array.from(e.target.files || []).slice(0, 5))} />
            </label>
            <label className="flex min-h-[44px] items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={diagnosticConsent} onChange={(e) => setDiagnosticConsent(e.target.checked)} className="h-4 w-4" />
              Share sanitized diagnostics for this problem
            </label>
          </div>
          {attachments.length ? <div className="mt-2 flex flex-wrap gap-2">{attachments.map((file, index) => <span key={`${file.name}-${index}`} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-foreground">{file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => setAttachments((items) => items.filter((_, i) => i !== index))}><X className="h-3.5 w-3.5" /></button></span>)}</div> : null}
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> Diagnostics are allowlisted and redacted. Workspace is troubleshooting context only; passwords, tokens, API keys, authorization headers, and unrelated tenant data are excluded.</p>
          <Button type="button" className="mt-4 min-h-[44px] w-full gap-2" onClick={handleCreate} disabled={busy || problem.trim().length < 3}><Send className="h-4 w-4" aria-hidden="true" /> {busy ? "Starting support…" : "Ask Titan Support"}</Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
          <h2 className="font-semibold text-foreground">Your support cases</h2>
          <p className="mt-1 text-sm text-muted-foreground">Select a case to continue the conversation. Agent and engineering replies update live.</p>
          <div className="mt-4 max-h-[430px] space-y-2 overflow-y-auto pr-1">
            {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading support cases…</p> : cases.length === 0 ? <div className="rounded-lg border border-dashed border-border p-6 text-center"><MessageCircle className="mx-auto mb-2 h-6 w-6 text-muted-foreground" /><p className="text-sm font-medium text-foreground">No support cases yet</p><p className="mt-1 text-xs text-muted-foreground">Your cases will appear here with their full history.</p></div> : cases.map((item) => (
              <button key={item.id} type="button" onClick={() => setSelectedCaseId(item.id)} className={`w-full rounded-lg border p-3 text-left transition-colors focus-ring ${selectedCaseId === item.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{item.case_number} · {item.title}</p><p className="mt-1 text-xs text-muted-foreground">{workspaceLabel(item.workspace)} · {item.category.replaceAll("_", " ")} · {new Date(item.updated_at).toLocaleString()}</p></div><CaseStatus value={item.status} /></div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {selectedCase ? (
        <section className="mt-5 rounded-xl border border-border bg-card shadow-soft" aria-label="Support conversation">
          <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{selectedCase.case_number}</p><h2 className="text-lg font-semibold text-foreground">{selectedCase.title}</h2><div className="mt-2 flex flex-wrap items-center gap-2"><CaseStatus value={selectedCase.status} /><span className="text-xs text-muted-foreground">{workspaceLabel(selectedCase.workspace)} · Priority {selectedCase.priority}</span></div></div>
            <div className="flex flex-wrap gap-2">
              {canEscalate ? <Button type="button" variant="outline" className="min-h-[44px] gap-2" onClick={handleEscalate} disabled={busy}><UserRound className="h-4 w-4" aria-hidden="true" /> Talk to a Human</Button> : null}
              {canReopen ? <Button type="button" variant="outline" className="min-h-[44px] gap-2" onClick={handleReopen} disabled={busy}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Reopen case</Button> : null}
            </div>
          </div>
          <div className="max-h-[520px] space-y-3 overflow-y-auto p-5" aria-live="polite">
            {(detail?.messages || []).map((item) => {
              const mine = item.sender_kind === "customer";
              return <div key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-xl px-4 py-3 text-sm leading-relaxed ${mine ? "bg-primary text-primary-foreground" : item.sender_kind === "system" ? "border border-border bg-muted text-muted-foreground" : "border border-border bg-background text-foreground"}`}><p className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-70">{mine ? "You" : item.sender_kind === "support_ai" ? "Titan Support AI" : item.sender_kind === "agent" ? "Titan Support Live" : item.sender_kind === "engineering" ? "Engineering" : "Titan Support"}</p><p className="whitespace-pre-wrap">{item.body}</p><p className="mt-2 text-[10px] opacity-60">{new Date(item.created_at).toLocaleString()}</p></div></div>;
            })}
          </div>
          {canSend ? <div className="border-t border-border p-4"><div className="flex gap-2"><Textarea aria-label="Message Titan Support" value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={10000} placeholder="Reply to this support case…" className="min-h-[52px] resize-none" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} /><Button type="button" aria-label="Send message" className="min-h-[52px] min-w-[52px]" onClick={handleSend} disabled={busy || !message.trim()}><Send className="h-4 w-4" /></Button></div></div> : null}
          {showCsat ? <div className="border-t border-border bg-muted/30 p-5"><h3 className="font-semibold text-foreground">Did we solve your problem?</h3><Textarea value={csatComment} onChange={(e) => setCsatComment(e.target.value)} rows={2} maxLength={2000} placeholder="Optional comment" className="mt-3 max-w-xl" /><div className="mt-3 flex gap-2"><Button type="button" onClick={() => handleCsat(true)} disabled={busy}>Yes</Button><Button type="button" variant="outline" onClick={() => handleCsat(false)} disabled={busy}>No</Button></div></div> : null}
        </section>
      ) : null}
    </PageShell>
  );
}
