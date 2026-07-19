import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/api/apiClient";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { Briefcase, Search, Clock, MapPin, User, Calendar, CheckSquare, Square, X, ChevronDown, UserCheck, Plus, Camera, LogIn, LogOut } from "lucide-react";
import DeleteButton from "@/components/shared/DeleteButton";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import PullToRefreshIndicator from "@/components/shared/PullToRefreshIndicator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import NativeSelect from "@/components/shared/NativeSelect";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import FormField from "@/components/shared/FormField";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import VirtualList, { shouldVirtualize } from "@/components/shared/VirtualList";
import ReviewForm from "@/components/shared/ReviewForm";
import { useEntityData } from "@/hooks/useEntityData";
import { todayISO, formatMonthDay } from "@/lib/date-utils";
import { useAuth } from "@/lib/AuthContext";
import { addJobPhoto, listJobPhotos, recordCheckin } from "@/lib/jobOpsApi";
import { checklistForService } from "@/lib/checklistTemplates";
import { enqueueFollowUpsForJob } from "@/lib/followUpApi";
import { toast } from "@/components/ui/use-toast";
import { googleMapsLink, jobSiteCoords, openStreetMapEmbed } from "@/lib/geofence";
import { generateJobSummary } from "@/lib/jobSummary";

const PRIORITY_COLORS = {
  low: "text-muted-foreground", medium: "text-titan-cyan",
  high: "text-titan-amber", urgent: "text-red-400",
};

const BLANK_FORM = {
  title: "", description: "", customer_id: "", customer_name: "",
  status: "scheduled", priority: "medium", service_type: "",
  scheduled_date: todayISO(), scheduled_time: "09:00",
  estimated_duration: 2, address: "", amount: 0, color: "#00C7D9",
};

const JOB_STATUSES = ["scheduled", "in_progress", "completed", "cancelled"];

export default function Jobs({ isActive = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { data: [jobs, customers, employees], loading, error, reload } = useEntityData([
    { entity: "Job",      method: "list", args: ["-scheduled_date", 100] },
    { entity: "Customer", method: "list", args: ["-created_date",   100] },
    { entity: "Employee", method: "list", args: ["-created_date",   50]  },
  ], { enabled: isActive });

  const [search, setSearch]         = useState("");
  const [filter, setFilter]         = useState("all");
  const [form, setForm]             = useState(BLANK_FORM);
  const [saving, setSaving]         = useState(false);
  const [localJobs, setLocalJobs]   = useState(null);

  // Bulk selection state
  const [bulkMode, setBulkMode]     = useState(false);
  const [selected, setSelected]     = useState(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [showBulkStatus, setShowBulkStatus] = useState(false);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [completingId, setCompletingId] = useState(null);
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [jobPhotos, setJobPhotos] = useState({});
  const [opsSaving, setOpsSaving] = useState(false);
  const [checklists, setChecklists] = useState({});

  const showForm = new URLSearchParams(location.search).get("new") === "1";
  const openForm  = () => navigate("?new=1");
  const closeForm = () => navigate("/jobs", { replace: true });

  const displayJobs = localJobs ?? jobs;

  useEffect(() => { setLocalJobs(null); }, [jobs]);

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.title || !form.scheduled_date) return;
    setSaving(true);
    const tempId = `temp_${Date.now()}`;
    setLocalJobs(prev => [{ ...form, id: tempId }, ...(prev ?? jobs)]);
    setForm(BLANK_FORM);
    closeForm();
    try {
      await api.entities.Job.create(form);
      reload();
    } catch {
      setLocalJobs(null);
    } finally { setSaving(false); }
  };

  const { containerRef, pullProgress, isRefreshing, pullDist } = usePullToRefresh(
    useCallback(async () => { await reload(); }, [reload])
  );

  const filtered = displayJobs
    .filter(j => filter === "all" || j.status === filter)
    .filter(j => `${j.title} ${j.customer_name ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  // ── Bulk helpers ──────────────────────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(j => j.id)));
    }
  };

  const exitBulk = () => {
    setBulkMode(false);
    setSelected(new Set());
  };

  const bulkUpdateStatus = async (status) => {
    setBulkSaving(true);
    setShowBulkStatus(false);
    try {
      await Promise.all([...selected].map(id => api.entities.Job.update(id, { status })));
      setLocalJobs(prev =>
        (prev ?? jobs).map(j => selected.has(j.id) ? { ...j, status } : j)
      );
      exitBulk();
    } finally { setBulkSaving(false); }
  };

  const bulkAssign = async (employee) => {
    setBulkSaving(true);
    setShowBulkAssign(false);
    try {
      await Promise.all([...selected].map(id =>
        api.entities.Job.update(id, { assigned_to: employee.id, assigned_name: employee.name })
      ));
      setLocalJobs(prev =>
        (prev ?? jobs).map(j => selected.has(j.id) ? { ...j, assigned_name: employee.name, assigned_to: employee.id } : j)
      );
      exitBulk();
    } finally { setBulkSaving(false); }
  };

  const markComplete = async (job) => {
    if (job.status === "completed" || completingId) return;
    setCompletingId(job.id);
    try {
      const photos = jobPhotos[job.id] || [];
      const checklist = checklists[job.id] || job.checklist || [];
      const summary = await generateJobSummary(job, { photos, checklist });
      await api.entities.Job.update(job.id, {
        status: "completed",
        completed_at: new Date().toISOString(),
        completion_summary: summary.completion_report,
        follow_up_draft: summary.follow_up_message,
        customer_notes_draft: summary.customer_notes,
        maintenance_reminder: summary.maintenance_reminder,
      });
      if (user?.id) await enqueueFollowUpsForJob(user, job, customers.find((customer) => customer.id === job.customer_id));
      setLocalJobs((prev) =>
        (prev ?? jobs).map((item) =>
          item.id === job.id
            ? {
                ...item,
                status: "completed",
                completion_summary: summary.completion_report,
                follow_up_draft: summary.follow_up_message,
              }
            : item
        )
      );
      toast({
        title: "Job completed + AI summary ready",
        description: summary.follow_up_message?.slice(0, 100) || summary.completion_report?.slice(0, 100),
      });
    } catch (err) {
      toast({
        title: "Couldn't complete job",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCompletingId(null);
    }
  };

  const openOps = async (job) => {
    const nextId = expandedJobId === job.id ? null : job.id;
    setExpandedJobId(nextId);
    if (nextId && !checklists[job.id]) setChecklists((current) => ({ ...current, [job.id]: job.checklist || checklistForService(job.service_type).map((label) => ({ label, done: false })) }));
    if (nextId && !jobPhotos[job.id]) {
      try {
        const photos = await listJobPhotos(job.id);
        setJobPhotos((current) => ({ ...current, [job.id]: photos }));
      } catch { setJobPhotos((current) => ({ ...current, [job.id]: [] })); }
    }
  };

  const checkin = async (job, eventType) => {
    if (!user?.id || opsSaving) return;
    setOpsSaving(true);
    try {
      const result = await recordCheckin(user, { jobId: job.id, eventType, job });
      const g = result?.geofence;
      if (g?.ok === true) {
        toast({ title: "Checked in on-site", description: `${g.meters}m from job site` });
      } else if (g?.ok === false) {
        toast({ title: "Checked in (outside geofence)", description: `${g.meters}m away — site radius ${g.radius}m`, variant: "destructive" });
      } else if (g?.reason === "no_site_coords") {
        toast({ title: eventType === "check_in" ? "Checked in" : "Checked out", description: "No site coords on job — GPS logged if available" });
      } else {
        toast({ title: eventType === "check_in" ? "Checked in" : "Checked out" });
      }
    } catch (err) {
      toast({ title: "Check-in failed", description: err.message, variant: "destructive" });
    } finally {
      setOpsSaving(false);
    }
  };

  const uploadPhoto = async (job, kind, file) => {
    if (!user?.id || !file || opsSaving) return;
    setOpsSaving(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      const photo = await addJobPhoto(user, { jobId: job.id, kind, url: file_url });
      setJobPhotos((current) => ({ ...current, [job.id]: [photo, ...(current[job.id] || [])] }));
    } finally { setOpsSaving(false); }
  };
  const toggleChecklist = async (job, index) => {
    const items = (checklists[job.id] || []).map((item, itemIndex) => itemIndex === index ? { ...item, done: !item.done } : item);
    setChecklists((current) => ({ ...current, [job.id]: items }));
    await api.entities.Job.update(job.id, { checklist: items });
  };

  if (!isActive && !jobs.length) return null;
  if (loading && !jobs.length) return <PageLoader variant="list" label="Loading jobs" />;
  if (error) return <ErrorState title="Couldn't load jobs" onRetry={reload} />;

  const renderJobRow = (job) => (
    <div
      onClick={() => bulkMode ? toggleSelect(job.id) : null}
      className={`glass rounded-2xl p-4 transition-all ${bulkMode ? "cursor-pointer" : "glass-hover"} ${
        bulkMode && selected.has(job.id) ? "border border-titan-cyan/40 bg-titan-cyan/5" : ""
      }`}
    >
      <div className="flex items-start gap-4">
        {bulkMode && (
          <div className="flex-shrink-0 mt-1">
            {selected.has(job.id)
              ? <CheckSquare className="w-4 h-4 text-titan-cyan" />
              : <Square className="w-4 h-4 text-muted-foreground" />}
          </div>
        )}
        <div className="w-1 h-14 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: job.color || "#00C7D9" }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold text-foreground truncate">{job.title}</p>
            <StatusBadge status={job.status} />
            <span className={`text-xs font-semibold ${PRIORITY_COLORS[job.priority]}`}>● {job.priority}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {job.customer_name && <span className="flex items-center gap-1 text-xs text-muted-foreground"><User className="w-3 h-3" />{job.customer_name}</span>}
            {job.assigned_name && <span className="flex items-center gap-1 text-xs text-muted-foreground"><UserCheck className="w-3 h-3" />{job.assigned_name}</span>}
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="w-3 h-3" />{formatMonthDay(job.scheduled_date)}</span>
            {job.scheduled_time && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" />{job.scheduled_time}</span>}
            {job.address && <span className="flex items-center gap-1 text-xs text-muted-foreground truncate max-w-[160px]"><MapPin className="w-3 h-3" />{job.address}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {job.amount > 0 && <p className="text-sm font-bold text-emerald-400">${job.amount.toLocaleString()}</p>}
          {job.status !== "completed" && !bulkMode && (
            <Button onClick={() => markComplete(job)} disabled={completingId === job.id} size="sm"
              className="bg-emerald-400/15 hover:bg-emerald-400/25 text-emerald-300 border border-emerald-400/20 rounded-lg text-xs">
              {completingId === job.id ? "Saving…" : "Complete"}
            </Button>
          )}
          {!bulkMode && <Button onClick={() => openOps(job)} variant="outline" size="sm" className="border-border text-foreground/90 rounded-lg text-xs">Field ops</Button>}
          {!bulkMode && (
            <DeleteButton
              label={job.title || "this job"}
              onDelete={async () => {
                await api.entities.Job.delete(job.id);
                setLocalJobs((prev) => (prev ?? jobs).filter((j) => j.id !== job.id));
                reload();
              }}
            />
          )}
        </div>
      </div>
      {(expandedJobId === job.id || ["in_progress", "completed"].includes(job.status)) && !bulkMode && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => checkin(job, "check_in")} disabled={opsSaving} size="sm" className="bg-titan-cyan/15 text-titan-cyan border border-titan-cyan/20"><LogIn className="w-4 h-4 mr-1" />Check in</Button>
            <Button onClick={() => checkin(job, "check_out")} disabled={opsSaving} size="sm" variant="outline" className="border-border text-foreground"><LogOut className="w-4 h-4 mr-1" />Check out</Button>
            {["before", "after"].map((kind) => <label key={kind} className="inline-flex items-center cursor-pointer h-9 px-3 rounded-md border border-border text-xs text-foreground/90 hover:bg-muted"><Camera className="w-4 h-4 mr-1" />{kind === "before" ? "Before photo" : "After photo"}<input type="file" accept="image/*" className="hidden" onChange={(e) => uploadPhoto(job, kind, e.target.files?.[0])} /></label>)}
          </div>
          {(() => {
            const site = jobSiteCoords(job);
            if (!site) return <p className="text-xs text-muted-foreground mt-2">Add site lat/lng on the job for geofence proof.</p>;
            return (
              <div className="mt-3 rounded-xl overflow-hidden border border-border">
                <iframe title="Job site map" src={openStreetMapEmbed(site.lat, site.lng)} className="w-full h-36 border-0" loading="lazy" />
                <a href={googleMapsLink(site.lat, site.lng)} target="_blank" rel="noreferrer" className="block text-xs text-titan-cyan px-3 py-2 bg-muted/40">Open site in Maps · geofence {job.geofence_m || 150}m</a>
              </div>
            );
          })()}
          {!!checklists[job.id]?.length && <div className="mt-3 grid sm:grid-cols-2 gap-2">{checklists[job.id].map((item, index) => <button key={item.label} onClick={() => toggleChecklist(job, index)} className="text-left text-xs text-foreground/85 flex items-center gap-2"><span className={item.done ? "text-titan-cyan" : "text-muted-foreground"}>{item.done ? "✓" : "○"}</span>{item.label}</button>)}</div>}
          {!!jobPhotos[job.id]?.length && (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                {jobPhotos[job.id].map((photo) => (
                  <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="relative">
                    <img src={photo.url} alt={`${photo.kind || "Job"} photo`} className="w-16 h-16 object-cover rounded-lg border border-border" />
                    <span className="absolute bottom-0 left-0 right-0 text-[9px] text-center bg-black/60 capitalize">{photo.kind}</span>
                  </a>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-border text-foreground text-xs"
                onClick={() => {
                  const after = jobPhotos[job.id].find((p) => p.kind === "after") || jobPhotos[job.id][0];
                  const text = `Before & after from ${job.title || "our latest job"} — powered by TitanOS`;
                  if (navigator.share) {
                    navigator.share({ title: job.title || "Job gallery", text, url: after.url }).catch(() => {});
                  } else {
                    navigator.clipboard?.writeText(`${text}\n${after.url}`);
                    toast({ title: "Gallery link copied" });
                  }
                }}
              >
                Share before/after
              </Button>
            </div>
          )}
        </div>
      )}
      {job.status === "completed" && !bulkMode && (
        <div className="mt-4 pt-4 border-t border-border space-y-3">
          {(job.completion_summary || job.follow_up_draft) && (
            <div className="rounded-xl bg-muted/50 p-3 text-xs text-foreground/90 space-y-2">
              <p className="font-semibold text-titan-cyan">AI job summary</p>
              {job.completion_summary && <p>{job.completion_summary}</p>}
              {job.follow_up_draft && (
                <button
                  type="button"
                  className="text-titan-cyan underline"
                  onClick={() => {
                    navigator.clipboard?.writeText(job.follow_up_draft);
                    toast({ title: "Follow-up copied" });
                  }}
                >
                  Copy follow-up message
                </button>
              )}
            </div>
          )}
          <ReviewForm
            jobId={job.id}
            revieweeId={job.customer_id ? `customer:${job.customer_id}` : ""}
            reviewerRole="worker"
            onSubmitted={reload}
          />
        </div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className="p-4 md:p-8 max-w-7xl mx-auto overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
      <PullToRefreshIndicator pullProgress={pullProgress} isRefreshing={isRefreshing} pullDist={pullDist} />

      <div className="flex items-start justify-between mb-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Jobs</h1>
          <p className="text-sm text-muted-foreground mt-1">{jobs.length} total</p>
        </motion.div>
        <div className="flex items-center gap-2">
          {!bulkMode && (
            <button
              onClick={() => setBulkMode(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-titan-cyan border border-border hover:border-titan-cyan/30 rounded-xl px-3 py-2 transition-all"
            >
              <CheckSquare className="w-3.5 h-3.5" /> Bulk Edit
            </button>
          )}
          <Button onClick={openForm}
            className="bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl gap-2">
            <Plus className="w-4 h-4" /> New Job
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search jobs…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-11 bg-card border-border text-foreground rounded-xl h-11 placeholder:text-muted-foreground/80" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["all", "scheduled", "in_progress", "completed", "cancelled"].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all capitalize ${
                filter === s ? "bg-titan-cyan/10 text-titan-cyan border border-titan-cyan/20" : "bg-card text-muted-foreground border border-border hover:text-foreground/90"
              }`}>
              {s === "all" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk mode header */}
      {bulkMode && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-titan-cyan/5 border border-titan-cyan/20 rounded-2xl">
          <button onClick={toggleAll} className="flex items-center gap-2 text-sm text-foreground/90 hover:text-foreground transition-colors">
            {selected.size === filtered.length && filtered.length > 0
              ? <CheckSquare className="w-4 h-4 text-titan-cyan" />
              : <Square className="w-4 h-4" />}
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </button>
          <button onClick={exitBulk} className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {filtered.length === 0 && !search && filter === "all" ? (
        <EmptyState icon={Briefcase} title="No jobs yet" description="Create your first job to start tracking work." onAction={openForm} actionLabel="New Job" />
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-16 text-sm">No jobs match your filter.</p>
      ) : shouldVirtualize(filtered.length) ? (
        <VirtualList
          items={filtered}
          renderItem={renderJobRow}
          className="pb-28"
          scrollRef={containerRef}
        />
      ) : (
        <div className="space-y-2 pb-28">
          {filtered.map((job, i) => (
            <motion.div key={job.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
              {renderJobRow(job)}
            </motion.div>
          ))}
        </div>
      )}

      {/* Floating bulk action bar */}
      <AnimatePresence>
        {bulkMode && selected.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-card border border-border rounded-2xl shadow-2xl px-4 py-3"
          >
            <span className="text-xs text-muted-foreground mr-1">{selected.size} job{selected.size > 1 ? "s" : ""}</span>

            {/* Status dropdown */}
            <div className="relative">
              <button
                onClick={() => { setShowBulkStatus(p => !p); setShowBulkAssign(false); }}
                className="flex items-center gap-1.5 bg-titan-cyan/10 hover:bg-titan-cyan/20 text-titan-cyan border border-titan-cyan/20 rounded-xl px-3 py-2 text-xs font-medium transition-all"
              >
                Set Status <ChevronDown className="w-3 h-3" />
              </button>
              {showBulkStatus && (
                <div className="absolute bottom-full mb-2 left-0 bg-muted border border-border rounded-xl overflow-hidden shadow-xl min-w-[140px]">
                  {JOB_STATUSES.map(s => (
                    <button key={s} onClick={() => bulkUpdateStatus(s)}
                      className="w-full text-left px-4 py-2.5 text-xs text-foreground hover:bg-muted hover:text-foreground capitalize transition-colors">
                      {s.replace("_", " ")}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Assign dropdown */}
            <div className="relative">
              <button
                onClick={() => { setShowBulkAssign(p => !p); setShowBulkStatus(false); }}
                className="flex items-center gap-1.5 bg-titan-indigo/10 hover:bg-titan-indigo/20 text-purple-300 border border-titan-indigo/20 rounded-xl px-3 py-2 text-xs font-medium transition-all"
              >
                Assign To <ChevronDown className="w-3 h-3" />
              </button>
              {showBulkAssign && (
                <div className="absolute bottom-full mb-2 left-0 bg-muted border border-border rounded-xl overflow-hidden shadow-xl min-w-[160px]">
                  {(employees || []).filter(e => e.status === "active").map(emp => (
                    <button key={emp.id} onClick={() => bulkAssign(emp)}
                      className="w-full text-left px-4 py-2.5 text-xs text-foreground hover:bg-muted hover:text-foreground transition-colors">
                      {emp.name}
                    </button>
                  ))}
                  {(employees || []).filter(e => e.status === "active").length === 0 && (
                    <p className="px-4 py-3 text-xs text-muted-foreground">No active employees</p>
                  )}
                </div>
              )}
            </div>

            {bulkSaving && <span className="text-xs text-muted-foreground ml-1">Saving…</span>}
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showForm} onOpenChange={open => { if (!open) closeForm(); }}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-foreground text-lg">New Job</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <FormField label="Job Title" value={form.title} onChange={e => f("title", e.target.value)} placeholder="e.g. Full house cleaning" />
            <FormField label="Customer">
              <NativeSelect
                value={form.customer_id}
                onValueChange={v => {
                  const c = customers.find(c => c.id === v);
                  setForm(prev => ({ ...prev, customer_id: v, customer_name: c ? `${c.first_name} ${c.last_name}` : "", address: c?.address || prev.address }));
                }}
                placeholder="Select customer"
                options={customers.map(c => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))}
                className="mt-1"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Date" type="date" value={form.scheduled_date} onChange={e => f("scheduled_date", e.target.value)} />
              <FormField label="Time" type="time" value={form.scheduled_time} onChange={e => f("scheduled_time", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Priority">
                <NativeSelect
                  value={form.priority}
                  onValueChange={v => f("priority", v)}
                  placeholder="Priority"
                  options={["low","medium","high","urgent"].map(p => ({ value: p, label: p }))}
                  className="mt-1"
                />
              </FormField>
              <FormField label="Amount ($)" type="number" value={form.amount} onChange={e => f("amount", parseFloat(e.target.value) || 0)} />
            </div>
            <FormField label="Address" value={form.address} onChange={e => f("address", e.target.value)} />
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs font-medium">Description</label>
              <Textarea value={form.description} onChange={e => f("description", e.target.value)}
                className="bg-muted border-border text-foreground rounded-xl min-h-[80px]" />
            </div>
            <Button onClick={handleSave} disabled={saving || !form.title} className="w-full bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-11 disabled:opacity-50">
              {saving ? "Creating…" : "Create Job"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}