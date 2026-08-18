import React, { useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ExternalLink,
  Mail,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  Workflow,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import { toast } from "@/components/ui/use-toast";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import { getPlanCheckoutUrl, resolvePlan } from "@/lib/plan";
import { createLead, deleteLead, listLeads, updateStatus } from "@/lib/leadsApi";
import { importLeadsFromCsv } from "@/lib/leadImportApi";
import { discoverNearbyLeads } from "@/lib/leadDiscoveryApi";
import { formatCurrency } from "@/lib/formatCurrency";

const today = () => new Date().toISOString().slice(0, 10);
const LEAD_STATUSES = ["new", "called", "emailed", "interested", "scheduled", "won", "lost"];

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

function leadDuplicate(leads, candidate) {
  const email = normalized(candidate.email);
  const phone = String(candidate.phone || "").replace(/\D/g, "");
  const name = normalized(candidate.name);
  const address = normalized(candidate.address);
  return leads.some((lead) => {
    if (email && normalized(lead.email) === email) return true;
    if (phone && String(lead.phone || "").replace(/\D/g, "") === phone) return true;
    return name && normalized(lead.name) === name && (!address || normalized(lead.address) === address);
  });
}

function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not available on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => reject(new Error("Allow location access so Titan can search for nearby business leads.")),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

function LeadStats({ leads }) {
  const interested = leads.filter((lead) => ["interested", "scheduled"].includes(lead.status)).length;
  const won = leads.filter((lead) => lead.status === "won").length;
  const pipeline = leads
    .filter((lead) => !["won", "lost"].includes(lead.status))
    .reduce((sum, lead) => sum + (Number(lead.estimated_value) || 0), 0);
  const stats = [
    ["Total leads", leads.length],
    ["Interested", interested],
    ["Won", won],
    ["Open value", formatCurrency(pipeline)],
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(([label, value]) => (
        <div key={label} className="titan-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{value}</p>
        </div>
      ))}
    </div>
  );
}

export default function Autopilot() {
  const { user, authChecked, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const checkout = searchParams.get("checkout");
  const returnedOrder = searchParams.get("order");
  const initialTab = checkout === "success" ? "automation" : searchParams.get("tab") === "automation" ? "automation" : "leads";
  const [tab, setTabState] = useState(initialTab);

  const [pipelineQuery, setPipelineQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [showAddLead, setShowAddLead] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: "", email: "", phone: "", city: "", state: "", estimated_value: "", notes: "" });
  const [savingLead, setSavingLead] = useState(false);
  const csvRef = useRef(null);

  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const [radius, setRadius] = useState(10);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryResults, setDiscoveryResults] = useState([]);
  const [discoveryMeta, setDiscoveryMeta] = useState(null);
  const [savedDiscoveryIds, setSavedDiscoveryIds] = useState(new Set());

  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [working, setWorking] = useState(false);

  const setTab = (next) => {
    setTabState(next);
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  const {
    data: leads = [],
    loading: leadsLoading,
    error: leadsError,
    reload: reloadLeads,
  } = useSafeAsync(
    () => listLeads(user?.id),
    [user?.id],
    { enabled: Boolean(user?.id), initial: [] }
  );

  const {
    data: invoices = [],
    loading: invoicesLoading,
    error: invoicesError,
    reload: reloadInvoices,
  } = useSafeAsync(
    () => api.entities.Invoice.list("due_date", 200),
    [user?.id, tab],
    { enabled: Boolean(user?.id) && tab === "automation", initial: [] }
  );

  const filteredLeads = useMemo(() => {
    const q = normalized(pipelineQuery);
    return leads.filter((lead) => {
      const active = statusFilter === "all" || (statusFilter === "active" ? !["won", "lost"].includes(lead.status) : lead.status === statusFilter);
      if (!active) return false;
      if (!q) return true;
      return [lead.name, lead.email, lead.phone, lead.city, lead.state, lead.source, lead.notes]
        .some((value) => normalized(value).includes(q));
    });
  }, [leads, pipelineQuery, statusFilter]);

  const eligibleInvoices = useMemo(
    () => invoices.filter((invoice) =>
      invoice.status !== "paid" &&
      invoice.customer_email &&
      invoice.due_date &&
      invoice.due_date < today() &&
      Number(invoice.balance_due ?? invoice.total) > 0
    ),
    [invoices]
  );

  const paidMembership = user?.paying_subscriber === true && ["worker_premium", "business"].includes(resolvePlan(user));
  const showOneTime = import.meta.env.VITE_AUTOPILOT_ONETIME_CHECKOUT === "true";

  const saveManualLead = async (event) => {
    event.preventDefault();
    if (!user?.id || savingLead) return;
    const name = leadForm.name.trim();
    if (!name) {
      toast({ variant: "destructive", title: "Lead name is required" });
      return;
    }
    setSavingLead(true);
    try {
      await createLead(user, {
        ...leadForm,
        name,
        estimated_value: Number(leadForm.estimated_value) || 0,
        source: "manual",
      });
      setLeadForm({ name: "", email: "", phone: "", city: "", state: "", estimated_value: "", notes: "" });
      setShowAddLead(false);
      await reloadLeads();
      toast({ title: "Lead added" });
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't add lead", description: error?.message || "Try again." });
    } finally {
      setSavingLead(false);
    }
  };

  const importCsv = async (file) => {
    if (!file || !user) return;
    try {
      const text = await file.text();
      const result = await importLeadsFromCsv(user, text);
      await reloadLeads();
      toast({ title: "Lead list imported", description: `${result.count} lead${result.count === 1 ? "" : "s"} added.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't import leads", description: error?.message || "Check the CSV and try again." });
    } finally {
      if (csvRef.current) csvRef.current.value = "";
    }
  };

  const discover = async () => {
    const query = discoveryQuery.trim();
    if (query.length < 2 || discovering) return;
    setDiscovering(true);
    try {
      const position = await currentPosition();
      const result = await discoverNearbyLeads({
        query,
        lat: position.lat,
        lng: position.lng,
        radiusMiles: Number(radius) || 10,
        limit: 15,
      });
      setDiscoveryResults(result.results || []);
      setDiscoveryMeta(result);
      if (!(result.results || []).length) {
        toast({ title: "No nearby matches found", description: "Try a broader business category or a larger radius." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Lead discovery couldn't run", description: error?.message || "Try again shortly." });
    } finally {
      setDiscovering(false);
    }
  };

  const saveDiscoveredLead = async (candidate) => {
    if (!user?.id) return;
    if (leadDuplicate(leads, candidate)) {
      toast({ title: "Already in your pipeline", description: `${candidate.name} appears to be saved already.` });
      setSavedDiscoveryIds((current) => new Set(current).add(candidate.external_id));
      return;
    }
    try {
      await createLead(user, {
        name: candidate.name,
        email: candidate.email || "",
        phone: candidate.phone || "",
        address: candidate.address || "",
        city: candidate.city || "",
        state: candidate.state || "",
        source: "openstreetmap",
        notes: [
          candidate.category ? `Category: ${candidate.category}` : "",
          candidate.website ? `Website: ${candidate.website}` : "",
          candidate.source_url ? `Source: ${candidate.source_url}` : "",
        ].filter(Boolean).join("\n"),
      });
      setSavedDiscoveryIds((current) => new Set(current).add(candidate.external_id));
      await reloadLeads();
      toast({ title: "Lead saved", description: `${candidate.name} was added to your pipeline.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't save this lead", description: error?.message || "Try again." });
    }
  };

  const changeLeadStatus = async (lead, status) => {
    try {
      await updateStatus(user.id, lead.id, status);
      await reloadLeads();
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't update lead", description: error?.message || "Try again." });
    }
  };

  const removeLead = async (lead) => {
    if (!window.confirm(`Delete ${lead.name || "this lead"}?`)) return;
    try {
      await deleteLead(user.id, lead.id);
      await reloadLeads();
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't delete lead", description: error?.message || "Try again." });
    }
  };

  const toggleInvoice = (id) => {
    setSelectedInvoices((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < 10
          ? [...current, id]
          : current
    );
  };

  const checkoutNow = async () => {
    setWorking(true);
    try {
      const result = await api.functions.invoke("createAutopilotOrder", { invoice_ids: selectedInvoices });
      if (!result.checkout_url) throw new Error("Checkout URL missing");
      window.location.assign(result.checkout_url);
    } catch (error) {
      toast({ title: "Checkout couldn't start", description: error?.message, variant: "destructive" });
      setWorking(false);
    }
  };

  const runOrder = async () => {
    setWorking(true);
    try {
      const result = await api.functions.invoke("runAutopilotOrder", { order_id: returnedOrder });
      toast({
        title: result.duplicate ? "Sprint already completed" : "Recovery sprint completed",
        description: `${result.sent || 0} sent · ${result.failed || 0} failed`,
      });
      await reloadInvoices();
    } catch (error) {
      toast({ title: "Sprint isn't ready", description: error?.message, variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const runMembership = async () => {
    setWorking(true);
    try {
      const result = await api.functions.invoke("runAutopilotMembership", { invoice_ids: selectedInvoices });
      const queued = result.delivery_mode === "review_queue";
      toast({
        title: queued ? "Reminders prepared for review" : "Included recovery sprint completed",
        description: queued
          ? `${result.prepared || 0} ready for review`
          : `${result.sent || 0} sent · ${result.failed || 0} failed`,
      });
    } catch (error) {
      toast({ title: "Sprint couldn't run", description: error?.message, variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  if (!authChecked || isLoadingAuth) return <PageLoader variant="list" label="Loading Titan Auto" />;
  if (!user) {
    return (
      <EmptyState
        title="Sign in to use Titan Auto"
        description="Lead discovery, your pipeline, and approved automations are tied to your account."
        actionLabel="Sign in"
        onAction={() => { window.location.href = "/login"; }}
      />
    );
  }

  return (
    <div className="page-pad mx-auto max-w-6xl pb-24">
      <PageHeader
        eyebrow="Growth"
        title="Titan Auto + Leads"
        subtitle="Find nearby business prospects, manage the pipeline, and automate repetitive work only after you approve it."
      />

      <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/20 p-1.5">
        <button
          type="button"
          onClick={() => setTab("leads")}
          className={`min-h-[44px] rounded-lg px-3 text-sm font-semibold focus-ring ${tab === "leads" ? "bg-card text-primary shadow-soft" : "text-muted-foreground"}`}
        >
          Leads
        </button>
        <button
          type="button"
          onClick={() => setTab("automation")}
          className={`min-h-[44px] rounded-lg px-3 text-sm font-semibold focus-ring ${tab === "automation" ? "bg-card text-primary shadow-soft" : "text-muted-foreground"}`}
        >
          Automations
        </button>
      </div>

      {tab === "leads" ? (
        <div className="space-y-5">
          {leadsLoading && !leads.length ? <PageLoader variant="list" label="Loading leads" /> : null}
          {leadsError && !leads.length ? <ErrorState title="Couldn't load leads" onRetry={reloadLeads} /> : null}
          {!leadsLoading || leads.length ? <LeadStats leads={leads} /> : null}

          <section className="titan-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Lead Finder</p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">Find nearby businesses</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Search a business category near your current location, review the public place data, then choose what belongs in your pipeline.
                </p>
              </div>
              <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_120px_auto]">
              <Input
                value={discoveryQuery}
                onChange={(event) => setDiscoveryQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void discover();
                  }
                }}
                placeholder="roofers, restaurants, real estate, electricians…"
                aria-label="Business type to find"
              />
              <Input
                type="number"
                min="1"
                max="25"
                value={radius}
                onChange={(event) => setRadius(event.target.value)}
                aria-label="Lead search radius in miles"
              />
              <Button type="button" onClick={discover} disabled={discovering || discoveryQuery.trim().length < 2} className="gap-2">
                <Search className={`h-4 w-4 ${discovering ? "animate-pulse" : ""}`} aria-hidden="true" />
                {discovering ? "Finding…" : "Find leads"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Radius is in miles. Titan requests your device location only when you run a search.</p>

            {discoveryResults.length ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {discoveryResults.map((candidate) => {
                  const saved = savedDiscoveryIds.has(candidate.external_id) || leadDuplicate(leads, candidate);
                  return (
                    <article key={candidate.external_id} className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-foreground">{candidate.name}</h3>
                          <p className="mt-1 text-xs capitalize text-muted-foreground">{candidate.category || "business"}</p>
                        </div>
                        <Button type="button" size="sm" variant={saved ? "outline" : "default"} disabled={saved} onClick={() => saveDiscoveredLead(candidate)}>
                          {saved ? "Saved" : "Save lead"}
                        </Button>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        {candidate.address ? <p>{candidate.address}</p> : null}
                        {candidate.phone ? <p>{candidate.phone}</p> : null}
                        {candidate.email ? <p>{candidate.email}</p> : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs">
                        {candidate.website ? <a href={candidate.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary">Website <ArrowUpRight className="h-3 w-3" /></a> : null}
                        {candidate.source_url ? <a href={candidate.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary">Map source <ArrowUpRight className="h-3 w-3" /></a> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}

            {discoveryMeta ? (
              <p className="mt-4 text-[11px] text-muted-foreground">
                {discoveryMeta.attribution || "Business place data © OpenStreetMap contributors"}. Verify contact details and fit before outreach.
                {discoveryMeta.cached ? " Cached result." : ""}
              </p>
            ) : null}
          </section>

          <section className="titan-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Pipeline</p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">Your leads</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={csvRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => void importCsv(event.target.files?.[0])}
                />
                <Button type="button" variant="outline" onClick={() => csvRef.current?.click()} className="gap-2">
                  <Upload className="h-4 w-4" aria-hidden="true" /> Import CSV
                </Button>
                <Button type="button" onClick={() => setShowAddLead((value) => !value)} className="gap-2">
                  <Plus className="h-4 w-4" aria-hidden="true" /> Add lead
                </Button>
              </div>
            </div>

            {showAddLead ? (
              <form onSubmit={saveManualLead} className="mt-4 grid gap-3 rounded-xl border border-border bg-muted/15 p-4 sm:grid-cols-2">
                <Input value={leadForm.name} onChange={(event) => setLeadForm((current) => ({ ...current, name: event.target.value }))} placeholder="Lead or business name" required />
                <Input type="email" value={leadForm.email} onChange={(event) => setLeadForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" />
                <Input value={leadForm.phone} onChange={(event) => setLeadForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone" />
                <Input value={leadForm.estimated_value} onChange={(event) => setLeadForm((current) => ({ ...current, estimated_value: event.target.value }))} type="number" min="0" step="0.01" placeholder="Estimated value" />
                <Input value={leadForm.city} onChange={(event) => setLeadForm((current) => ({ ...current, city: event.target.value }))} placeholder="City" />
                <Input value={leadForm.state} onChange={(event) => setLeadForm((current) => ({ ...current, state: event.target.value }))} placeholder="State" />
                <Textarea value={leadForm.notes} onChange={(event) => setLeadForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes" className="sm:col-span-2" />
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" disabled={savingLead}>{savingLead ? "Saving…" : "Save lead"}</Button>
                  <Button type="button" variant="outline" onClick={() => setShowAddLead(false)}>Cancel</Button>
                </div>
              </form>
            ) : null}

            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_170px_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input value={pipelineQuery} onChange={(event) => setPipelineQuery(event.target.value)} placeholder="Search your pipeline" className="pl-9" />
              </div>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-[44px] rounded-md border border-input bg-background px-3 text-sm text-foreground">
                <option value="active">Active leads</option>
                <option value="all">All leads</option>
                {LEAD_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <Button type="button" variant="outline" onClick={() => navigate(`/assistant?q=${encodeURIComponent("Review my lead pipeline and tell me which prospects deserve attention next. Do not contact anyone without asking me first.")}`)} className="gap-2">
                <Bot className="h-4 w-4" aria-hidden="true" /> Ask 2nd Self
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {filteredLeads.length ? filteredLeads.map((lead) => (
                <article key={lead.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-foreground">{lead.name || "Lead"}</h3>
                        <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{lead.status || "new"}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{[lead.email, lead.phone, [lead.city, lead.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || "No contact details yet"}</p>
                      {lead.estimated_value ? <p className="mt-1 text-xs font-semibold text-foreground">Potential value {formatCurrency(lead.estimated_value)}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={lead.status || "new"} onChange={(event) => void changeLeadStatus(lead, event.target.value)} className="min-h-[40px] rounded-md border border-input bg-background px-2 text-xs capitalize text-foreground">
                        {LEAD_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                      <button type="button" onClick={() => void removeLead(lead)} className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-ring" aria-label={`Delete ${lead.name || "lead"}`}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              )) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No leads match this view. Find nearby businesses, import a CSV, or add one manually.
                </div>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-5">
          {checkout === "success" && returnedOrder ? (
            <section className="titan-surface border border-emerald-500/30 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" aria-hidden="true" />
                <div className="flex-1">
                  <h2 className="font-semibold text-foreground">Payment received</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Run the approved invoice sprint after payment verification. Repeated clicks are idempotent.</p>
                </div>
              </div>
              <Button className="mt-4" onClick={runOrder} disabled={working}>{working ? "Checking payment…" : "Run approved sprint"}</Button>
            </section>
          ) : null}

          <section className="titan-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Workflow className="h-7 w-7 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Approved automation</p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">Automate repetition, not authority</h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Titan can prepare or run bounded repetitive work after you choose the records and approve the action.</p>
                </div>
              </div>
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => navigate(`/assistant?q=${encodeURIComponent("Review my current leads and draft a practical outreach plan. Do not send messages or change lead status without asking me first.")}`)} className="rounded-xl border border-border p-4 text-left hover:border-primary/40 focus-ring">
                <Users className="h-5 w-5 text-primary" aria-hidden="true" />
                <p className="mt-3 font-semibold text-foreground">Lead outreach plan</p>
                <p className="mt-1 text-xs text-muted-foreground">Use 2nd Self to prioritize and draft outreach while keeping sending under your control.</p>
              </button>
              <button type="button" onClick={() => navigate(`/assistant?q=${encodeURIComponent("Review my business and identify repetitive work that Titan can safely automate with confirmation.")}`)} className="rounded-xl border border-border p-4 text-left hover:border-primary/40 focus-ring">
                <Bot className="h-5 w-5 text-primary" aria-hidden="true" />
                <p className="mt-3 font-semibold text-foreground">Find automation opportunities</p>
                <p className="mt-1 text-xs text-muted-foreground">Let 2nd Self propose bounded automations from real Titan context.</p>
              </button>
            </div>
          </section>

          {invoicesLoading ? <PageLoader variant="list" label="Checking invoice recovery" /> : null}
          {invoicesError ? <ErrorState title="Couldn't load invoice recovery" onRetry={reloadInvoices} /> : null}
          {!invoicesLoading && !invoicesError ? (
            <section className="titan-surface p-5">
              <div className="flex items-start gap-3">
                <Mail className="h-6 w-6 text-primary" aria-hidden="true" />
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Invoice Recovery</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Choose up to 10 overdue invoices with customer email addresses. Titan prepares or sends the approved reminder workflow according to your entitlement and delivery configuration.</p>
                </div>
              </div>

              {!paidMembership ? (
                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">Monthly recovery automation is a paid capability</p>
                    <p className="mt-1 text-sm text-muted-foreground">Your business operations and lead pipeline remain available without running this paid automation.</p>
                  </div>
                  <Button asChild className="shrink-0"><a href={getPlanCheckoutUrl("worker_premium")} target="_blank" rel="noopener noreferrer">View Pro <ExternalLink className="h-4 w-4" /></a></Button>
                </div>
              ) : null}

              <div className="mt-5">
                <p className="mb-3 text-sm font-semibold text-foreground">Eligible invoices <span className="font-normal text-muted-foreground">({selectedInvoices.length}/10 selected)</span></p>
                {eligibleInvoices.length ? eligibleInvoices.map((invoice) => (
                  <label key={invoice.id} className="flex min-h-[56px] cursor-pointer items-center gap-3 border-b border-border py-3">
                    <input type="checkbox" className="h-5 w-5" checked={selectedInvoices.includes(invoice.id)} onChange={() => toggleInvoice(invoice.id)} disabled={!selectedInvoices.includes(invoice.id) && selectedInvoices.length >= 10} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">{invoice.customer_name || "Customer"}</span>
                      <span className="block truncate text-xs text-muted-foreground">{invoice.invoice_number || "Invoice"} · {invoice.customer_email} · due {invoice.due_date}</span>
                    </span>
                    <span className="font-semibold tabular-nums text-foreground">{formatCurrency(invoice.balance_due ?? invoice.total)}</span>
                  </label>
                )) : (
                  <EmptyState title="No eligible invoices" description="Only unpaid, past-due invoices with a customer email appear here." actionLabel="Open invoices" onAction={() => navigate("/invoices")} />
                )}
              </div>

              {eligibleInvoices.length ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {paidMembership ? <Button disabled={!selectedInvoices.length || working} onClick={runMembership}>{working ? "Running…" : "Run included recovery"}</Button> : null}
                  {showOneTime ? <Button variant="outline" disabled={!selectedInvoices.length || working} onClick={checkoutNow}>{working ? "Opening checkout…" : <>One-time recovery <ExternalLink className="h-4 w-4" /></>}</Button> : null}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
