import React, { useState, useEffect, useMemo } from "react";
import { api } from "@/api/apiClient";
import { motion, AnimatePresence } from "framer-motion";
import { Car, Pencil, Plus, Trash2, Navigation, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StatHint from "@/components/shared/StatHint";
import { todayISO, formatMonthDay } from "@/lib/date-utils";
import { IRS_MILEAGE_RATE_USD, parseMilesInput } from "@/lib/driverHubMath";

const BLANK = {
  date: todayISO(),
  purpose: "",
  from_location: "",
  to_location: "",
  miles: "",
  customer_name: "",
  notes: "",
};

function tripDeduction(miles) {
  return Math.round(Number(miles || 0) * IRS_MILEAGE_RATE_USD * 100) / 100;
}

export default function MileTracker({ taxYear }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [milesError, setMilesError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = () => {
    setLoading(true);
    setLoadError("");
    api.entities.MileageTrip.filter({ tax_year: taxYear })
      .then((rows) => {
        // Newest first; drop nulls; coerce miles
        const list = (rows || [])
          .filter(Boolean)
          .map((t) => ({ ...t, miles: Number(t.miles) || 0 }));
        setTrips(list);
      })
      .catch((err) => {
        setLoadError(err?.message || "Couldn't load trips.");
        setTrips([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [taxYear]);

  const f = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const { totalMiles, totalDeduction } = useMemo(() => {
    const miles = trips.reduce((s, t) => s + (Number(t.miles) || 0), 0);
    const rounded = Math.round(miles * 10) / 10;
    return {
      totalMiles: rounded,
      totalDeduction: tripDeduction(rounded),
    };
  }, [trips]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...BLANK, date: todayISO() });
    setMilesError("");
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (trip) => {
    setEditingId(trip.id);
    setForm({
      date: trip.date || todayISO(),
      purpose: trip.purpose || "",
      from_location: trip.from_location || "",
      to_location: trip.to_location || "",
      miles: String(trip.miles ?? ""),
      customer_name: trip.customer_name || "",
      notes: trip.notes || "",
    });
    setMilesError("");
    setFormError("");
    setShowForm(true);
  };

  const onMilesChange = (value) => {
    f("miles", value);
    if (value === "") {
      setMilesError("");
      return;
    }
    const parsed = parseMilesInput(value, { max: 9999.9 });
    setMilesError(parsed.ok ? "" : parsed.error);
  };

  const handleSave = async () => {
    setFormError("");
    if (!form.purpose?.trim() || !form.date) {
      setFormError("Date and purpose are required.");
      return;
    }
    const parsed = parseMilesInput(form.miles, { max: 9999.9 });
    if (!parsed.ok) {
      setMilesError(parsed.error);
      setFormError(parsed.error);
      return;
    }
    // Reject zero-mile trips (not useful for tax logs)
    if (parsed.miles <= 0) {
      setMilesError("Enter more than 0 miles.");
      setFormError("Enter more than 0 miles.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        date: form.date,
        purpose: form.purpose.trim(),
        from_location: form.from_location.trim(),
        to_location: form.to_location.trim(),
        miles: parsed.miles,
        customer_name: form.customer_name.trim(),
        notes: form.notes?.trim?.() || form.notes || "",
        tax_year: taxYear,
      };

      if (editingId) {
        const updated = await api.entities.MileageTrip.update(editingId, payload);
        setTrips((prev) =>
          prev.map((t) =>
            t.id === editingId ? { ...t, ...updated, miles: Number(updated.miles) || parsed.miles } : t
          )
        );
      } else {
        const created = await api.entities.MileageTrip.create(payload);
        setTrips((prev) => [{ ...created, miles: Number(created.miles) || parsed.miles }, ...prev]);
      }
      setForm(BLANK);
      setEditingId(null);
      setShowForm(false);
      setMilesError("");
    } catch (err) {
      setFormError(err?.message || "Couldn't save trip. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await api.entities.MileageTrip.delete(id);
      setTrips((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setLoadError(err?.message || "Couldn't delete trip.");
    } finally {
      setDeleting(null);
    }
  };

  const previewMiles = parseMilesInput(form.miles === "" ? null : form.miles, { max: 9999.9 });
  const previewOk = previewMiles.ok && previewMiles.miles > 0;

  return (
    <div className="glass rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-titan-cyan/10 flex items-center justify-center flex-shrink-0">
            <Car className="w-5 h-5 text-titan-cyan" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">Mile Tracker</h3>
            <p className="text-xs text-muted-foreground">
              {taxYear} · IRS rate ${IRS_MILEAGE_RATE_USD}/mile
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={openCreate}
          className="bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-10 px-4 text-sm gap-1.5 flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> Log Trip
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl bg-titan-cyan/5 border border-titan-cyan/15 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Navigation className="w-3.5 h-3.5 text-titan-cyan" />
            <span className="text-xs text-muted-foreground">Total Miles</span>
            <StatHint label="Total Miles">
              <p>Sum of all business miles you logged for {taxYear}.</p>
              <p>Updates right away when you add, edit, or delete a trip.</p>
              <p>Why it matters: more documented miles = larger standard deduction.</p>
            </StatHint>
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {totalMiles.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {trips.length} trip{trips.length !== 1 ? "s" : ""} logged
          </p>
        </div>
        <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs text-muted-foreground">Tax Deduction</span>
            <StatHint label="Tax Deduction">
              <p>
                Total miles × ${IRS_MILEAGE_RATE_USD} (IRS standard mileage rate).
              </p>
              <p>Recalculates whenever your trip list changes.</p>
              <p>Estimate only — confirm with your tax pro at filing time.</p>
            </StatHint>
          </div>
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">
            $
            {totalDeduction.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">estimated deduction</p>
        </div>
      </div>

      {loadError ? (
        <p className="text-sm text-red-400 mb-3" role="alert">
          {loadError}{" "}
          <button type="button" className="underline text-foreground" onClick={load}>
            Retry
          </button>
        </p>
      ) : null}

      {/* Trip list */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm" aria-live="polite">
          Loading trips…
        </div>
      ) : trips.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-border rounded-xl px-4">
          <Car className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No trips logged for {taxYear}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Every business mile at ${IRS_MILEAGE_RATE_USD} = real tax savings
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-4 text-xs text-titan-cyan hover:text-titan-cyan/80 transition-colors min-h-[44px] px-2"
          >
            Log your first trip →
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {trips.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-2 sm:gap-3 p-3 rounded-xl bg-muted/50 border border-border group"
              >
                <div className="w-8 h-8 rounded-lg bg-titan-cyan/10 flex items-center justify-center flex-shrink-0">
                  <Car className="w-3.5 h-3.5 text-titan-cyan" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{t.purpose}</p>
                    {t.customer_name ? (
                      <span className="text-xs text-muted-foreground truncate">· {t.customer_name}</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground">{formatMonthDay(t.date)}</p>
                    {t.from_location && t.to_location ? (
                      <p className="text-xs text-muted-foreground truncate">
                        {t.from_location} → {t.to_location}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-foreground tabular-nums">{t.miles} mi</p>
                  <p className="text-xs text-emerald-400 tabular-nums">${tripDeduction(t.miles).toFixed(2)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(t)}
                  className="text-muted-foreground hover:text-foreground transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
                  aria-label={`Edit trip ${t.purpose || ""}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(t.id)}
                  disabled={deleting === t.id}
                  className="text-muted-foreground hover:text-red-400 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center disabled:opacity-50"
                  aria-label={`Delete trip ${t.purpose || ""}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Log / Edit Dialog */}
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          if (!open) {
            setForm(BLANK);
            setEditingId(null);
            setMilesError("");
            setFormError("");
            setShowForm(false);
          }
        }}
      >
        <DialogContent className="bg-card border-border text-foreground max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingId ? "Edit Business Trip" : "Log Business Trip"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="mt-date" className="text-muted-foreground text-xs font-medium block mb-1">
                  Date
                </label>
                <Input
                  id="mt-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => f("date", e.target.value)}
                  className="bg-muted border-border text-foreground rounded-xl h-10"
                />
              </div>
              <div>
                <label htmlFor="mt-miles" className="text-muted-foreground text-xs font-medium block mb-1">
                  Miles <span className="text-titan-cyan">*</span>
                </label>
                <Input
                  id="mt-miles"
                  type="number"
                  min="0.1"
                  max="9999.9"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={form.miles}
                  onChange={(e) => onMilesChange(e.target.value)}
                  aria-invalid={Boolean(milesError)}
                  aria-describedby={milesError ? "mt-miles-error" : undefined}
                  className="bg-muted border-border text-foreground rounded-xl h-10"
                />
                {milesError ? (
                  <p id="mt-miles-error" className="text-xs text-red-400 mt-1" role="alert">
                    {milesError}
                  </p>
                ) : null}
              </div>
            </div>
            <div>
              <label htmlFor="mt-purpose" className="text-muted-foreground text-xs font-medium block mb-1">
                Purpose <span className="text-titan-cyan">*</span>
              </label>
              <Input
                id="mt-purpose"
                placeholder="e.g. Client visit, Supply run"
                value={form.purpose}
                onChange={(e) => f("purpose", e.target.value)}
                className="bg-muted border-border text-foreground rounded-xl h-10"
              />
            </div>
            <div>
              <label htmlFor="mt-from" className="text-muted-foreground text-xs font-medium block mb-1">
                From
              </label>
              <Input
                id="mt-from"
                placeholder="Starting location"
                value={form.from_location}
                onChange={(e) => f("from_location", e.target.value)}
                className="bg-muted border-border text-foreground rounded-xl h-10"
              />
            </div>
            <div>
              <label htmlFor="mt-to" className="text-muted-foreground text-xs font-medium block mb-1">
                To
              </label>
              <Input
                id="mt-to"
                placeholder="Destination"
                value={form.to_location}
                onChange={(e) => f("to_location", e.target.value)}
                className="bg-muted border-border text-foreground rounded-xl h-10"
              />
            </div>
            <div>
              <label htmlFor="mt-customer" className="text-muted-foreground text-xs font-medium block mb-1">
                Client / Customer
              </label>
              <Input
                id="mt-customer"
                placeholder="Optional"
                value={form.customer_name}
                onChange={(e) => f("customer_name", e.target.value)}
                className="bg-muted border-border text-foreground rounded-xl h-10"
              />
            </div>

            {previewOk ? (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-center">
                <p className="text-xs text-muted-foreground">This trip saves you</p>
                <p className="text-xl font-bold text-emerald-400">
                  ${tripDeduction(previewMiles.miles).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">in estimated tax deductions</p>
              </div>
            ) : null}

            {formError ? (
              <p className="text-sm text-red-400" role="alert">
                {formError}
              </p>
            ) : null}

            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || Boolean(milesError) || !form.miles || !form.purpose}
              className="w-full bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-11 disabled:opacity-50"
            >
              {saving ? "Saving…" : editingId ? "Update Trip" : "Save Trip"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
