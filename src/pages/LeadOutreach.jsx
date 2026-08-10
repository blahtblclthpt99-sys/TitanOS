import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Mail, PauseCircle, Radar, RefreshCw, Search, Send, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { api } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import PremiumGate from "@/components/shared/PremiumGate";
import { canAccessFeature, PRO_FEATURES } from "@/lib/plan";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const BATCH_SIZE = 5;
const BATCH_DELAY_SECONDS = 60;

export default function LeadOutreach() {
  const { user, authChecked } = useAuth();
  const [leads, setLeads] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [industry, setIndustry] = useState("home and field service businesses");
  const [location, setLocation] = useState("United States");
  const [count, setCount] = useState(10);
  const [subject, setSubject] = useState("A simpler way to run your field operations");
  const [message, setMessage] = useState("Hi {{company}},\n\nI’m reaching out from TitanOS. We help service businesses organize leads, scheduling, field work, and follow-up in one practical workspace.\n\nWould a short walkthrough be useful for your team?\n\nBest,\nTitanOS");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [finding, setFinding] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(null);
  const stopSendingRef = useRef(false);
  const hasAccess = canAccessFeature(user, PRO_FEATURES.leadOutreach);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const rows = await api.entities.Lead.list("-created_date", 250);
      setLeads(rows.filter((lead) => EMAIL_RE.test(lead.email || "")));
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't load lead outreach", description: error?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authChecked) return;
    if (!user?.id || !hasAccess) { setLoading(false); return; }
    load();
  }, [authChecked, user?.id, hasAccess]);

  useEffect(() => () => { stopSendingRef.current = true; }, []);

  const ready = useMemo(
    () => leads.filter((lead) => selected.has(lead.id) && EMAIL_RE.test(lead.email || "") && lead.email_quality_status === "verified" && lead.outreach_status !== "sent" && lead.outreach_status !== "suppressed").slice(0, BATCH_SIZE),
    [leads, selected]
  );
  const sentCount = leads.filter((lead) => lead.outreach_status === "sent").length;

  const runWorkers = async () => {
    setFinding(true);
    try {
      const result = await api.functions.invoke("leadWorkerFind", { industry, location, count: Number(count) });
      await load();
      setSelected(new Set((result.leads || []).map((lead) => lead.id)));
      toast({ title: `${result.added || 0} leads added`, description: result.duplicates ? `${result.duplicates} duplicate contacts skipped.` : "Review every contact before sending." });
    } catch (error) {
      toast({ variant: "destructive", title: "Lead workers couldn't finish", description: error?.message || "Try a smaller search." });
    } finally {
      setFinding(false);
    }
  };

  const sendSelected = async () => {
    if (!ready.length || !confirmed) return;
    if (!window.confirm(`Send a maximum of ${BATCH_SIZE} verified business email${BATCH_SIZE === 1 ? "" : "s"} in this pilot? TitanOS enforces the daily limit on the server.`)) return;
    setSending(true);
    stopSendingRef.current = false;
    const queued = [...ready];
    let processed = 0;
    let sent = 0;
    let failed = 0;
    try {
      while (processed < queued.length && !stopSendingRef.current) {
        const batch = queued.slice(processed, processed + BATCH_SIZE);
        setSendProgress({ processed, total: queued.length, sent, failed, waiting: false });
        const result = await api.functions.invoke("leadWorkerSend", { leadIds: batch.map((lead) => lead.id), subject, message, confirmCompliant: true });
        sent += result.sent || 0;
        failed += result.failed || 0;
        processed += batch.length;
        setSelected((current) => {
          const next = new Set(current);
          batch.forEach((lead) => next.delete(lead.id));
          return next;
        });
        setSendProgress({ processed, total: queued.length, sent, failed, waiting: processed < queued.length, nextIn: BATCH_DELAY_SECONDS });
        await load();
        if (processed < queued.length && !stopSendingRef.current) {
          for (let remaining = BATCH_DELAY_SECONDS; remaining > 0 && !stopSendingRef.current; remaining -= 1) {
            setSendProgress((current) => current ? { ...current, nextIn: remaining } : current);
            await new Promise((resolve) => window.setTimeout(resolve, 1000));
          }
        }
      }
      if (processed >= queued.length) {
        setConfirmed(false);
        toast({ title: `${sent} emails sent`, description: failed ? `${failed} deliveries failed and remain available for review.` : "The outreach queue finished." });
      } else {
        toast({ title: "Email queue stopped", description: `${queued.length - processed} leads remain selected.` });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Email send failed", description: error?.message });
    } finally {
      setSending(false);
      setSendProgress(null);
    }
  };

  const stopSending = () => {
    stopSendingRef.current = true;
    setSendProgress((current) => current ? { ...current, waiting: false } : current);
  };

  const removeLead = async (lead) => {
    if (!window.confirm(`Remove ${lead.email}?`)) return;
    try {
      await api.entities.Lead.delete(lead.id);
      setLeads((current) => current.filter((item) => item.id !== lead.id));
      setSelected((current) => { const next = new Set(current); next.delete(lead.id); return next; });
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't remove lead", description: error?.message });
    }
  };

  if (!authChecked || loading) return <PageLoader variant="list" label="Loading Lead Workers" />;
  if (!hasAccess) {
    return (
      <PageShell maxWidth="md">
        <PageHeader eyebrow="AI / Outreach" title="Lead Workers" subtitle="Private lead discovery and direct business outreach inside TitanOS." />
        <PremiumGate
          title="Premium workspace feature"
          description="Lead Workers is available to premium workspaces. Your leads remain private to your account, and access is verified by the server on every search and send."
        />
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="xl">
      <PageHeader
        eyebrow="AI / Outreach"
        title="Lead Workers"
        subtitle="Find or upload business contacts, verify them, and begin with a protected five-message pilot."
        actions={<Button variant="outline" size="icon" onClick={load} aria-label="Refresh leads"><RefreshCw /></Button>}
      />

      <section className="grid grid-cols-3 gap-3 mb-5" aria-label="Outreach summary">
        {[{ label: "Email leads", value: leads.length }, { label: "Ready", value: leads.length - sentCount }, { label: "Sent", value: sentCount }].map((metric) => (
          <div key={metric.label} className="titan-surface p-4 text-center">
            <strong className="block text-2xl text-foreground">{metric.value}</strong>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{metric.label}</span>
          </div>
        ))}
      </section>

      <div className="grid xl:grid-cols-[280px_minmax(0,1fr)_340px] lg:grid-cols-[260px_minmax(0,1fr)] gap-4 items-start">
        <section className="titan-surface p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-primary" />
            <div><h2 className="font-semibold text-foreground">Lead search</h2><p className="text-xs text-muted-foreground">Public business contacts only</p></div>
          </div>
          <label className="block text-xs font-medium text-muted-foreground">Industry<Input className="mt-1.5" value={industry} onChange={(event) => setIndustry(event.target.value)} /></label>
          <label className="block text-xs font-medium text-muted-foreground">Location<Input className="mt-1.5" value={location} onChange={(event) => setLocation(event.target.value)} /></label>
          <label className="block text-xs font-medium text-muted-foreground">Maximum leads<Input className="mt-1.5" type="number" min="1" max="25" value={count} onChange={(event) => setCount(event.target.value)} /></label>
          <Button className="w-full" onClick={runWorkers} disabled={finding || !industry || !location}>
            {finding ? <><RefreshCw className="animate-spin" /> Workers searching</> : <><Radar /> Run workers</>}
          </Button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">Workers must verify email addresses on each company’s own website. Guessed addresses and directory-only results are rejected.</p>
        </section>

        <section className="titan-surface overflow-hidden min-h-[440px]">
          <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
            <div><h2 className="font-semibold text-foreground">Lead review</h2><p className="text-xs text-muted-foreground">{ready.length} selected for outreach</p></div>
            {leads.length > 0 && <Button variant="outline" size="sm" disabled={sending} onClick={() => setSelected(selected.size ? new Set() : new Set(leads.filter((lead) => lead.email_quality_status === "verified" && lead.outreach_status !== "sent" && lead.outreach_status !== "suppressed").slice(0, BATCH_SIZE).map((lead) => lead.id)))}>{selected.size ? "Clear selection" : "Select verified pilot"}</Button>}
          </div>
          {leads.length === 0 ? (
            <EmptyState icon={Mail} title="No email leads yet" description="Run a focused search or upload a lead file from Leads. Contacts appear here for review before email is sent." />
          ) : (
            <div className="divide-y divide-border max-h-[650px] overflow-y-auto">
              {leads.map((lead) => {
                const isSent = lead.outreach_status === "sent";
                const isVerified = lead.email_quality_status === "verified";
                const isFailed = lead.outreach_status === "failed";
                return (
                  <article key={lead.id} className="grid grid-cols-[44px_minmax(0,1fr)_auto_44px] items-center gap-2 p-3 hover:bg-muted/40">
                    <div className="flex justify-center"><Checkbox checked={selected.has(lead.id)} disabled={isSent || !isVerified} onCheckedChange={(checked) => setSelected((current) => { const next = new Set(current); if (checked) next.add(lead.id); else next.delete(lead.id); return next; })} aria-label={`Select ${lead.email}`} /></div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{lead.company || lead.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                      {(lead.discovery_reason || lead.website) && <p className="text-[11px] text-muted-foreground/80 truncate mt-1">{lead.discovery_reason || lead.website}</p>}
                      {isFailed && lead.outreach_error && <p className="text-[11px] text-destructive truncate mt-1">{lead.outreach_error}</p>}
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${isSent ? "bg-success/15 text-success" : isFailed ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
                      {isSent ? <CheckCircle2 className="w-3 h-3" /> : isFailed ? <XCircle className="w-3 h-3" /> : null}{!isVerified ? "review" : (lead.outreach_status || "ready")}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => removeLead(lead)} aria-label={`Remove ${lead.email}`}><Trash2 className="text-destructive" /></Button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="titan-surface p-5 space-y-4 xl:col-auto lg:col-span-2">
          <div className="flex items-center gap-3"><Mail className="w-5 h-5 text-primary" /><div><h2 className="font-semibold text-foreground">Email compose</h2><p className="text-xs text-muted-foreground">Personalized for every selected lead</p></div></div>
          <label className="block text-xs font-medium text-muted-foreground">Subject<Input className="mt-1.5" value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
          <label className="block text-xs font-medium text-muted-foreground">Message<Textarea className="mt-1.5 min-h-[260px]" value={message} onChange={(event) => setMessage(event.target.value)} /></label>
          <p className="text-[11px] text-muted-foreground">Use <code className="text-primary">{"{{company}}"}</code> for the business name. TitanOS adds the advertisement disclosure, postal identity, and one-click unsubscribe.</p>
          <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-xs text-muted-foreground cursor-pointer">
            <Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(Boolean(value))} className="mt-0.5" />
            <span>I confirm these are relevant business contacts I am legally permitted to email, and I will honor opt-out requests.</span>
          </label>
          {sendProgress && <div className="rounded-xl border border-primary/30 bg-primary/5 p-3" role="status"><div className="flex items-center justify-between text-xs"><span className="font-semibold text-foreground">{sendProgress.processed} of {sendProgress.total} processed</span><span className="text-muted-foreground">{sendProgress.sent} sent · {sendProgress.failed} failed</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${Math.round((sendProgress.processed / sendProgress.total) * 100)}%` }} /></div>{sendProgress.waiting && <p className="mt-2 text-[11px] text-muted-foreground">Next batch sends in {sendProgress.nextIn} seconds. Keep TitanOS open.</p>}</div>}
          {sending ? <Button variant="outline" className="w-full" onClick={stopSending}><PauseCircle /> Stop after current batch</Button> : <Button variant="success" className="w-full" onClick={sendSelected} disabled={!ready.length || !confirmed}><Send /> Send verified pilot · max {BATCH_SIZE}</Button>}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><ShieldCheck className="w-4 h-4 text-success" /> Delivery credentials stay on the TitanOS server.</div>
        </section>
      </div>
    </PageShell>
  );
}
