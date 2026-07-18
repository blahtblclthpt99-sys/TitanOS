import React, { useState, useEffect } from "react";
import { api } from "@/api/apiClient";
import { motion } from "framer-motion";
import { FileText, Search, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import NativeSelect from "@/components/shared/NativeSelect";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import FormField from "@/components/shared/FormField";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import VirtualList, { shouldVirtualize } from "@/components/shared/VirtualList";
import { useEntityData } from "@/hooks/useEntityData";
import { addDaysISO, formatMonthDayYear } from "@/lib/date-utils";

const BLANK_FORM = { customer_id: "", customer_name: "", notes: "", service_type: "", address: "", tax_rate: 0 };
const BLANK_LINE = { description: "", quantity: 1, unit_price: 0, total: 0 };

export default function Estimates() {
  const { data: [estimates, customers], loading, error, reload } = useEntityData([
    { entity: "Estimate", method: "list", args: ["-created_date", 100] },
    { entity: "Customer", method: "list", args: ["-created_date", 100] },
  ]);

  const [search, setSearch]       = useState("");
  const [statusFilter, setStatus] = useState("all");
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(BLANK_FORM);
  const [lineItems, setLineItems] = useState([{ ...BLANK_LINE }]);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") setShowForm(true);
  }, []);

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const updateLine = (idx, field, raw) => {
    const value = field === "description" ? raw : (parseFloat(raw) || 0);
    setLineItems(prev => {
      const items = prev.map((item, i) => i === idx ? { ...item, [field]: value } : item);
      items[idx] = { ...items[idx], total: items[idx].quantity * items[idx].unit_price };
      return [...items];
    });
  };

  const subtotal  = lineItems.reduce((s, i) => s + (i.total || 0), 0);
  const taxAmount = subtotal * ((form.tax_rate || 0) / 100);
  const total     = subtotal + taxAmount;

  const handleSave = async () => {
    if (!form.customer_name) return;
    setSaving(true);
    try {
      await api.entities.Estimate.create({
        ...form,
        estimate_number: `EST-${Date.now().toString().slice(-6)}`,
        line_items: lineItems, subtotal, tax_amount: taxAmount, total, status: "draft",
        valid_until: addDaysISO(30),
      });
      setForm(BLANK_FORM);
      setLineItems([{ ...BLANK_LINE }]);
      setShowForm(false);
      reload();
    } finally { setSaving(false); }
  };

  const filtered = estimates
    .filter(e => statusFilter === "all" || e.status === statusFilter)
    .filter(e => `${e.customer_name ?? ""} ${e.estimate_number ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <PageLoader variant="list" label="Loading estimates" />;
  if (error) return <ErrorState title="Couldn't load estimates" onRetry={reload} />;

  const renderEstimateRow = (est) => (
    <div className="glass rounded-2xl p-4 glass-hover cursor-pointer">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold text-white">{est.estimate_number || "Draft"}</p>
            <StatusBadge status={est.status} />
          </div>
          <p className="text-xs text-white/40">{est.customer_name} · {formatMonthDayYear(est.created_date)}</p>
        </div>
        <p className="text-lg font-bold text-white flex-shrink-0">${(est.total || 0).toLocaleString()}</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Estimates" subtitle={`${estimates.length} total`} onAdd={() => setShowForm(true)} addLabel="New Estimate" />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input placeholder="Search estimates…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-11 bg-[#1A1A1C] border-white/5 text-white rounded-xl h-11 placeholder:text-white/20" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["all", "draft", "sent", "viewed", "accepted", "declined", "expired"].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all capitalize ${
                statusFilter === s ? "bg-titan-cyan/10 text-titan-cyan border border-titan-cyan/20" : "bg-[#1A1A1C] text-white/40 border border-white/5 hover:text-white/70"
              }`}>
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && !search && statusFilter === "all" ? (
        <EmptyState icon={FileText} title="No estimates yet" description="Create professional estimates to win more jobs." onAction={() => setShowForm(true)} actionLabel="New Estimate" />
      ) : filtered.length === 0 ? (
        <p className="text-center text-white/30 py-16 text-sm">No estimates match your filter.</p>
      ) : shouldVirtualize(filtered.length) ? (
        <VirtualList items={filtered} renderItem={renderEstimateRow} estimateSize={76} />
      ) : (
        <div className="space-y-2">
          {filtered.map((est, i) => (
            <motion.div key={est.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
              {renderEstimateRow(est)}
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) { setForm(BLANK_FORM); setLineItems([{ ...BLANK_LINE }]); } }}>
        <DialogContent className="bg-[#1A1A1C] border-white/5 text-white max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-white text-lg">New Estimate</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
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

            <div>
              <label className="text-white/50 text-xs font-medium block mb-2">Line Items</label>
              <div className="space-y-2">
                {lineItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input placeholder="Description" value={item.description}
                      onChange={e => updateLine(idx, "description", e.target.value)}
                      className="bg-[#242427] border-white/5 text-white rounded-xl flex-1 text-sm h-9" />
                    <Input type="number" placeholder="Qty" value={item.quantity}
                      onChange={e => updateLine(idx, "quantity", e.target.value)}
                      className="bg-[#242427] border-white/5 text-white rounded-xl w-16 text-sm h-9" />
                    <Input type="number" placeholder="Price" value={item.unit_price}
                      onChange={e => updateLine(idx, "unit_price", e.target.value)}
                      className="bg-[#242427] border-white/5 text-white rounded-xl w-24 text-sm h-9" />
                    <span className="text-sm text-white/50 w-20 text-right tabular-nums">${(item.total || 0).toFixed(2)}</span>
                    {lineItems.length > 1 && (
                      <button onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))} className="text-white/20 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => setLineItems([...lineItems, { ...BLANK_LINE }])}
                className="flex items-center gap-1 text-xs text-titan-cyan mt-3 hover:text-titan-cyan/80 transition-colors">
                <Plus className="w-3 h-3" /> Add line item
              </button>
            </div>

            <div className="bg-white/[0.03] rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-white/40">Subtotal</span><span className="text-white tabular-nums">${subtotal.toFixed(2)}</span></div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-white/40">Tax</span>
                  <Input type="number" value={form.tax_rate} onChange={e => f("tax_rate", parseFloat(e.target.value) || 0)}
                    className="bg-[#242427] border-white/5 text-white rounded-lg w-16 h-7 text-xs" />
                  <span className="text-white/40">%</span>
                </div>
                <span className="text-white tabular-nums">${taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-white/5 pt-2">
                <span className="text-white">Total</span>
                <span className="text-titan-cyan tabular-nums">${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-white/50 text-xs font-medium">Notes</label>
              <Textarea value={form.notes} onChange={e => f("notes", e.target.value)}
                className="bg-[#242427] border-white/5 text-white rounded-xl min-h-[60px]" />
            </div>

            <Button onClick={handleSave} disabled={saving || !form.customer_name}
              className="w-full bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-11 disabled:opacity-50">
              {saving ? "Creating…" : "Create Estimate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}