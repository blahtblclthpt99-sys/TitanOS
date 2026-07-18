import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/api/apiClient";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { Briefcase, Search, Clock, MapPin, User, Calendar, CheckSquare, Square, X, ChevronDown, UserCheck, Plus } from "lucide-react";
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
import { useEntityData } from "@/hooks/useEntityData";
import { todayISO, formatMonthDay } from "@/lib/date-utils";

const PRIORITY_COLORS = {
  low: "text-white/30", medium: "text-titan-cyan",
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
              : <Square className="w-4 h-4 text-white/25" />}
          </div>
        )}
        <div className="w-1 h-14 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: job.color || "#00C7D9" }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold text-white truncate">{job.title}</p>
            <StatusBadge status={job.status} />
            <span className={`text-xs font-semibold ${PRIORITY_COLORS[job.priority]}`}>● {job.priority}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {job.customer_name && <span className="flex items-center gap-1 text-xs text-white/40"><User className="w-3 h-3" />{job.customer_name}</span>}
            {job.assigned_name && <span className="flex items-center gap-1 text-xs text-white/40"><UserCheck className="w-3 h-3" />{job.assigned_name}</span>}
            <span className="flex items-center gap-1 text-xs text-white/40"><Calendar className="w-3 h-3" />{formatMonthDay(job.scheduled_date)}</span>
            {job.scheduled_time && <span className="flex items-center gap-1 text-xs text-white/40"><Clock className="w-3 h-3" />{job.scheduled_time}</span>}
            {job.address && <span className="flex items-center gap-1 text-xs text-white/40 truncate max-w-[160px]"><MapPin className="w-3 h-3" />{job.address}</span>}
          </div>
        </div>
        {job.amount > 0 && <p className="text-sm font-bold text-emerald-400 flex-shrink-0">${job.amount.toLocaleString()}</p>}
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="p-4 md:p-8 max-w-7xl mx-auto overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
      <PullToRefreshIndicator pullProgress={pullProgress} isRefreshing={isRefreshing} pullDist={pullDist} />

      <div className="flex items-start justify-between mb-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Jobs</h1>
          <p className="text-sm text-white/40 mt-1">{jobs.length} total</p>
        </motion.div>
        <div className="flex items-center gap-2">
          {!bulkMode && (
            <button
              onClick={() => setBulkMode(true)}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-titan-cyan border border-white/10 hover:border-titan-cyan/30 rounded-xl px-3 py-2 transition-all"
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
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input placeholder="Search jobs…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-11 bg-[#1A1A1C] border-white/5 text-white rounded-xl h-11 placeholder:text-white/20" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["all", "scheduled", "in_progress", "completed", "cancelled"].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all capitalize ${
                filter === s ? "bg-titan-cyan/10 text-titan-cyan border border-titan-cyan/20" : "bg-[#1A1A1C] text-white/40 border border-white/5 hover:text-white/70"
              }`}>
              {s === "all" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk mode header */}
      {bulkMode && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-titan-cyan/5 border border-titan-cyan/20 rounded-2xl">
          <button onClick={toggleAll} className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
            {selected.size === filtered.length && filtered.length > 0
              ? <CheckSquare className="w-4 h-4 text-titan-cyan" />
              : <Square className="w-4 h-4" />}
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </button>
          <button onClick={exitBulk} className="ml-auto text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {filtered.length === 0 && !search && filter === "all" ? (
        <EmptyState icon={Briefcase} title="No jobs yet" description="Create your first job to start tracking work." onAction={openForm} actionLabel="New Job" />
      ) : filtered.length === 0 ? (
        <p className="text-center text-white/30 py-16 text-sm">No jobs match your filter.</p>
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
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#1A1A1C] border border-white/10 rounded-2xl shadow-2xl px-4 py-3"
          >
            <span className="text-xs text-white/50 mr-1">{selected.size} job{selected.size > 1 ? "s" : ""}</span>

            {/* Status dropdown */}
            <div className="relative">
              <button
                onClick={() => { setShowBulkStatus(p => !p); setShowBulkAssign(false); }}
                className="flex items-center gap-1.5 bg-titan-cyan/10 hover:bg-titan-cyan/20 text-titan-cyan border border-titan-cyan/20 rounded-xl px-3 py-2 text-xs font-medium transition-all"
              >
                Set Status <ChevronDown className="w-3 h-3" />
              </button>
              {showBulkStatus && (
                <div className="absolute bottom-full mb-2 left-0 bg-[#242427] border border-white/10 rounded-xl overflow-hidden shadow-xl min-w-[140px]">
                  {JOB_STATUSES.map(s => (
                    <button key={s} onClick={() => bulkUpdateStatus(s)}
                      className="w-full text-left px-4 py-2.5 text-xs text-white/80 hover:bg-white/5 hover:text-white capitalize transition-colors">
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
                <div className="absolute bottom-full mb-2 left-0 bg-[#242427] border border-white/10 rounded-xl overflow-hidden shadow-xl min-w-[160px]">
                  {(employees || []).filter(e => e.status === "active").map(emp => (
                    <button key={emp.id} onClick={() => bulkAssign(emp)}
                      className="w-full text-left px-4 py-2.5 text-xs text-white/80 hover:bg-white/5 hover:text-white transition-colors">
                      {emp.name}
                    </button>
                  ))}
                  {(employees || []).filter(e => e.status === "active").length === 0 && (
                    <p className="px-4 py-3 text-xs text-white/30">No active employees</p>
                  )}
                </div>
              )}
            </div>

            {bulkSaving && <span className="text-xs text-white/40 ml-1">Saving…</span>}
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showForm} onOpenChange={open => { if (!open) closeForm(); }}>
        <DialogContent className="bg-[#1A1A1C] border-white/5 text-white max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-white text-lg">New Job</DialogTitle></DialogHeader>
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
              <label className="text-white/50 text-xs font-medium">Description</label>
              <Textarea value={form.description} onChange={e => f("description", e.target.value)}
                className="bg-[#242427] border-white/5 text-white rounded-xl min-h-[80px]" />
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