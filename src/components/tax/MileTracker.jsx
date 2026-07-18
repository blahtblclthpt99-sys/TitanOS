import React, { useState, useEffect } from "react";
import { api } from "@/api/apiClient";
import { motion, AnimatePresence } from "framer-motion";
import { Car, Plus, Trash2, Navigation, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { todayISO, formatMonthDay } from "@/lib/date-utils";

const MILEAGE_RATE = 0.67; // IRS 2024

const BLANK = {
  date: todayISO(),
  purpose: "",
  from_location: "",
  to_location: "",
  miles: "",
  customer_name: "",
  notes: "",
};

export default function MileTracker({ taxYear }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = () => {
    setLoading(true);
    api.entities.MileageTrip.filter({ tax_year: taxYear })
      .then(setTrips)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [taxYear]);

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const totalMiles = trips.reduce((s, t) => s + (t.miles || 0), 0);
  const totalDeduction = totalMiles * MILEAGE_RATE;

  const handleSave = async () => {
    if (!form.miles || !form.purpose || !form.date) return;
    setSaving(true);
    try {
      const created = await api.entities.MileageTrip.create({
        ...form,
        miles: parseFloat(form.miles) || 0,
        tax_year: taxYear,
      });
      setTrips(prev => [created, ...prev]);
      setForm(BLANK);
      setShowForm(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await api.entities.MileageTrip.delete(id);
      setTrips(prev => prev.filter(t => t.id !== id));
    } finally { setDeleting(null); }
  };

  return (
    <div className="glass rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-titan-cyan/10 flex items-center justify-center">
            <Car className="w-5 h-5 text-titan-cyan" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Mile Tracker</h3>
            <p className="text-xs text-white/40">{taxYear} · IRS rate $0.67/mile</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(true)}
          className="bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-10 px-4 text-sm gap-1.5">
          <Plus className="w-4 h-4" /> Log Trip
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl bg-titan-cyan/5 border border-titan-cyan/15 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Navigation className="w-3.5 h-3.5 text-titan-cyan" />
            <span className="text-xs text-white/40">Total Miles</span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">{totalMiles.toLocaleString()}</p>
          <p className="text-xs text-white/30 mt-0.5">{trips.length} trip{trips.length !== 1 ? "s" : ""} logged</p>
        </div>
        <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs text-white/40">Tax Deduction</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">${totalDeduction.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-white/30 mt-0.5">saved from your tax bill</p>
        </div>
      </div>

      {/* Trip list */}
      {loading ? (
        <div className="text-center py-8 text-white/30 text-sm">Loading trips…</div>
      ) : trips.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-white/10 rounded-xl">
          <Car className="w-8 h-8 text-white/20 mx-auto mb-3" />
          <p className="text-sm text-white/30">No trips logged for {taxYear}</p>
          <p className="text-xs text-white/20 mt-1">Every business mile at $0.67 = real tax savings</p>
          <button onClick={() => setShowForm(true)}
            className="mt-4 text-xs text-titan-cyan hover:text-titan-cyan/80 transition-colors">
            Log your first trip →
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {trips.map(t => (
              <motion.div key={t.id}
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 group">
                <div className="w-8 h-8 rounded-lg bg-titan-cyan/10 flex items-center justify-center flex-shrink-0">
                  <Car className="w-3.5 h-3.5 text-titan-cyan" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">{t.purpose}</p>
                    {t.customer_name && <span className="text-xs text-white/30 truncate">· {t.customer_name}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-white/35">{formatMonthDay(t.date)}</p>
                    {t.from_location && t.to_location && (
                      <p className="text-xs text-white/25 truncate">{t.from_location} → {t.to_location}</p>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-white tabular-nums">{t.miles} mi</p>
                  <p className="text-xs text-emerald-400 tabular-nums">${(t.miles * MILEAGE_RATE).toFixed(2)}</p>
                </div>
                <button onClick={() => handleDelete(t.id)} disabled={deleting === t.id}
                  className="ml-1 text-white/15 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 min-w-[32px] min-h-[32px] flex items-center justify-center">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Log Trip Dialog */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) { setForm(BLANK); setShowForm(false); } }}>
        <DialogContent className="bg-[#1A1A1C] border-white/5 text-white max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle className="text-white">Log Business Trip</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-white/50 text-xs font-medium block mb-1">Date</label>
                <Input type="date" value={form.date} onChange={e => f("date", e.target.value)}
                  className="bg-[#242427] border-white/5 text-white rounded-xl h-10" />
              </div>
              <div>
                <label className="text-white/50 text-xs font-medium block mb-1">Miles <span className="text-titan-cyan">*</span></label>
                <Input type="number" placeholder="0.0" value={form.miles} onChange={e => f("miles", e.target.value)}
                  className="bg-[#242427] border-white/5 text-white rounded-xl h-10" />
              </div>
            </div>
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1">Purpose <span className="text-titan-cyan">*</span></label>
              <Input placeholder="e.g. Client visit, Supply run" value={form.purpose} onChange={e => f("purpose", e.target.value)}
                className="bg-[#242427] border-white/5 text-white rounded-xl h-10" />
            </div>
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1">From</label>
              <Input placeholder="Starting location" value={form.from_location} onChange={e => f("from_location", e.target.value)}
                className="bg-[#242427] border-white/5 text-white rounded-xl h-10" />
            </div>
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1">To</label>
              <Input placeholder="Destination" value={form.to_location} onChange={e => f("to_location", e.target.value)}
                className="bg-[#242427] border-white/5 text-white rounded-xl h-10" />
            </div>
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1">Client / Customer</label>
              <Input placeholder="Optional" value={form.customer_name} onChange={e => f("customer_name", e.target.value)}
                className="bg-[#242427] border-white/5 text-white rounded-xl h-10" />
            </div>

            {/* Live deduction preview */}
            {form.miles > 0 && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-center">
                <p className="text-xs text-white/50">This trip saves you</p>
                <p className="text-xl font-bold text-emerald-400">${(parseFloat(form.miles) * MILEAGE_RATE).toFixed(2)}</p>
                <p className="text-xs text-white/30">in tax deductions</p>
              </div>
            )}

            <Button onClick={handleSave} disabled={saving || !form.miles || !form.purpose}
              className="w-full bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-11 disabled:opacity-50">
              {saving ? "Saving…" : "Save Trip"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}