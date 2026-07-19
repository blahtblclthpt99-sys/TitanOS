import React, { useMemo, useRef, useState } from "react";
import { api } from "@/api/apiClient";
import { Camera, Download, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import FormField from "@/components/shared/FormField";
import NativeSelect from "@/components/shared/NativeSelect";
import { useEntityData } from "@/hooks/useEntityData";
import { EXPENSE_CATEGORIES } from "@/lib/platformConstants";
import { formatMonthDayYear, todayISO } from "@/lib/date-utils";

const blankExpense = () => ({
  category: "other", amount: "", date: todayISO(), description: "", notes: "", vendor: "",
  receipt_url: "", is_tax_deductible: true, business_use_percent: 100,
});

const csvValue = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export default function BusinessExpenses({ taxYear, onChanged }) {
  const { data: [expenses], loading, reload } = useEntityData([
    { entity: "Expense", method: "list", args: ["-date", 500] },
  ]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankExpense);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const f = (key, value) => setForm(previous => ({ ...previous, [key]: value }));

  const yearExpenses = useMemo(
    () => expenses.filter(expense => new Date(expense.date).getFullYear() === taxYear),
    [expenses, taxYear]
  );
  const totals = useMemo(() => {
    const categories = {};
    let grandTotal = 0;
    yearExpenses.forEach(expense => {
      const amount = Number(expense.amount || 0);
      const category = expense.category || "other";
      categories[category] = (categories[category] || 0) + amount;
      grandTotal += amount;
    });
    return { categories, grandTotal };
  }, [yearExpenses]);

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(blankExpense());
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      f("receipt_url", file_url);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.description.trim() || !Number(form.amount) || !form.date) return;
    setSaving(true);
    const payload = {
      ...form,
      amount: Number(form.amount),
      business_use_percent: Number(form.business_use_percent) || 0,
      tax_year: new Date(form.date).getFullYear(),
    };
    try {
      if (editingId) await api.entities.Expense.update(editingId, payload);
      else await api.entities.Expense.create(payload);
      closeForm();
      await reload();
      onChanged?.();
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (expense) => {
    setEditingId(expense.id);
    setForm({
      ...blankExpense(), ...expense,
      amount: String(expense.amount ?? ""),
      business_use_percent: Number(expense.business_use_percent ?? 100),
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this expense?")) return;
    await api.entities.Expense.delete(id);
    await reload();
    onChanged?.();
  };

  const exportCsv = () => {
    const columns = ["date", "category", "description", "vendor", "amount", "business_use_percent", "is_tax_deductible", "notes"];
    const contents = [columns.join(","), ...yearExpenses.map(expense => columns.map(column => csvValue(expense[column])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([contents], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `titanos-business-expenses-${taxYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="glass rounded-2xl p-5 md:p-6 mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Business Expenses</h2>
          <p className="text-xs text-muted-foreground mt-1">Track Schedule C expenses and receipt records for {taxYear}.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!yearExpenses.length} className="border-border text-foreground/90 rounded-xl"><Download className="w-4 h-4 mr-1" /> CSV</Button>
          <Button onClick={() => setShowForm(true)} className="bg-titan-cyan hover:bg-titan-cyan/90 text-black rounded-xl"><Plus className="w-4 h-4 mr-1" /> Add expense</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="rounded-xl bg-titan-cyan/10 border border-titan-cyan/20 p-3"><p className="text-lg font-bold text-titan-cyan">${totals.grandTotal.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total expenses</p></div>
        {Object.entries(totals.categories).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([category, total]) => <div key={category} className="rounded-xl bg-muted/50 p-3"><p className="text-sm font-semibold text-foreground">${total.toLocaleString()}</p><p className="text-xs text-muted-foreground capitalize">{category}</p></div>)}
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading expenses…</p> : yearExpenses.length ? (
        <div className="space-y-2">
          {yearExpenses.map(expense => <div key={expense.id} className="rounded-xl bg-muted/50 p-3 flex items-center gap-3">
            {expense.receipt_url ? <img src={expense.receipt_url} alt="Receipt" className="w-10 h-10 object-cover rounded-lg" /> : <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">—</div>}
            <div className="min-w-0 flex-1"><p className="text-sm text-foreground truncate">{expense.description}</p><p className="text-xs text-muted-foreground capitalize">{expense.category} · {expense.vendor || "No vendor"} · {formatMonthDayYear(expense.date)}</p></div>
            <div className="text-right"><p className="text-sm font-semibold text-foreground">${Number(expense.amount || 0).toLocaleString()}</p><p className={`text-xs ${expense.is_tax_deductible !== false ? "text-emerald-400" : "text-muted-foreground"}`}>{expense.is_tax_deductible !== false ? "Deductible" : "Not deductible"}</p></div>
            <button onClick={() => handleEdit(expense)} className="p-2 text-muted-foreground hover:text-titan-cyan" aria-label={`Edit ${expense.description}`}><Pencil className="w-4 h-4" /></button>
            <button onClick={() => handleDelete(expense.id)} className="p-2 text-muted-foreground hover:text-red-400" aria-label={`Delete ${expense.description}`}><Trash2 className="w-4 h-4" /></button>
          </div>)}
        </div>
      ) : <p className="text-sm text-muted-foreground py-4">No business expenses recorded for {taxYear}.</p>}

      <Dialog open={showForm} onOpenChange={open => { if (!open) closeForm(); else setShowForm(true); }}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Edit" : "Add"} business expense</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <FormField label="Description" value={form.description} onChange={event => f("description", event.target.value)} placeholder="e.g. Fuel fill-up" />
            <div className="grid grid-cols-2 gap-3"><FormField label="Amount ($)" type="number" min="0" step="0.01" value={form.amount} onChange={event => f("amount", event.target.value)} /><FormField label="Date" type="date" value={form.date} onChange={event => f("date", event.target.value)} /></div>
            <FormField label="Category"><NativeSelect value={form.category} onValueChange={value => f("category", value)} options={EXPENSE_CATEGORIES.map(category => ({ value: category.id, label: category.label }))} className="mt-1" /></FormField>
            <FormField label="Vendor" value={form.vendor} onChange={event => f("vendor", event.target.value)} placeholder="Optional" />
            <FormField label="Notes"><Textarea value={form.notes} onChange={event => f("notes", event.target.value)} className="bg-muted border-border text-foreground rounded-xl" placeholder="Business purpose or receipt details" /></FormField>
            <div className="grid grid-cols-2 gap-3 items-end"><FormField label="Business use (%)" type="number" min="0" max="100" value={form.business_use_percent} onChange={event => f("business_use_percent", event.target.value)} /><label className="flex items-center gap-2 text-sm text-foreground/90 h-10"><input type="checkbox" checked={form.is_tax_deductible !== false} onChange={event => f("is_tax_deductible", event.target.checked)} className="accent-cyan-400" /> Tax deductible</label></div>
            <div><label className="text-xs text-muted-foreground mb-2 block">Receipt</label><input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUpload} />{form.receipt_url ? <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3"><a href={form.receipt_url} target="_blank" rel="noreferrer" className="text-sm text-titan-cyan truncate flex-1">View attached receipt</a><button onClick={() => f("receipt_url", "")} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button></div> : <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full h-20 rounded-xl border border-dashed border-border hover:border-titan-cyan/40 text-muted-foreground flex flex-col justify-center items-center gap-1">{uploading ? "Uploading…" : <><Camera className="w-5 h-5" /><span className="text-xs">Attach receipt</span></>}</button>}</div>
            <Button onClick={handleSave} disabled={saving || !form.description.trim() || !Number(form.amount)} className="w-full bg-titan-cyan hover:bg-titan-cyan/90 text-black rounded-xl">{saving ? "Saving…" : "Save expense"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
