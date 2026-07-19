import React, { useState, useRef, Suspense, lazy } from "react";
import { api } from "@/api/apiClient";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, TrendingDown, Receipt, Plus, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import NativeSelect from "@/components/shared/NativeSelect";
import PageHeader from "@/components/shared/PageHeader";
import FormField from "@/components/shared/FormField";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import { useEntityData } from "@/hooks/useEntityData";
import { todayISO, formatMonthDay } from "@/lib/date-utils";
import { buildFinanceSummary, buildExpenseCategoryData } from "@/lib/finance-metrics";

const FinancesExpenseChart = lazy(() => import("@/components/charts/FinancesExpenseChart"));
const EXPENSE_CATS = ["fuel","supplies","equipment","vehicle","insurance","marketing","payroll","rent","utilities","other"];

const BLANK_EXPENSE = {
  description: "",
  amount: 0,
  category: "other",
  date: todayISO(),
  vendor: "",
  receipt_url: "",
  is_tax_deductible: true,
  business_use_percent: 100,
};

export default function Finances() {
  const { data: [invoices, expenses], loading, error, reload } = useEntityData([
    { entity: "Invoice", method: "list", args: ["-created_date", 100] },
    { entity: "Expense", method: "list", args: ["-date", 100] },
  ]);

  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState(BLANK_EXPENSE);
  const [saving, setSaving]           = useState(false);
  const [uploading, setUploading]     = useState(false);
  const fileInputRef                  = useRef(null);

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      f("receipt_url", file_url);
    } finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!form.description || !form.amount) return;
    setSaving(true);
    try {
      await api.entities.Expense.create(form);
      setForm(BLANK_EXPENSE);
      setShowForm(false);
      reload();
    } finally { setSaving(false); }
  };

  const { totalRevenue, totalExpenses, profit, outstanding } = buildFinanceSummary(invoices, expenses);
  const categoryData = buildExpenseCategoryData(expenses);

  const summaryCards = [
    { label: "Revenue",     value: `$${totalRevenue.toLocaleString()}`,  icon: TrendingUp,   color: "text-emerald-400",  bg: "bg-emerald-400/10" },
    { label: "Expenses",    value: `$${totalExpenses.toLocaleString()}`, icon: TrendingDown, color: "text-red-400",      bg: "bg-red-400/10" },
    { label: profit >= 0 ? "Profit" : "Loss",
      value: `$${Math.abs(profit).toLocaleString()}`,
      icon: DollarSign,
      color: profit >= 0 ? "text-emerald-400" : "text-red-400",
      bg:    profit >= 0 ? "bg-emerald-400/10" : "bg-red-400/10" },
    { label: "Outstanding", value: `$${outstanding.toLocaleString()}`,   icon: Receipt,      color: "text-titan-amber", bg: "bg-titan-amber/10" },
  ];

  if (loading) return <PageLoader variant="list" label="Loading finances" />;
  if (error) return <ErrorState title="Couldn't load finances" onRetry={reload} />;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Finances" subtitle="Profit & loss overview" onAdd={() => setShowForm(true)} addLabel="Add Expense" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {summaryCards.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="glass rounded-2xl p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.bg}`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold text-white tabular-nums">{card.value}</p>
            <p className="text-sm text-white/40 mt-1">{card.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {categoryData.length > 0 ? (
          <Suspense fallback={
            <div className="glass rounded-2xl p-6 min-h-[200px] flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-titan-cyan/30 border-t-titan-cyan rounded-full animate-spin" />
            </div>
          }>
            <FinancesExpenseChart categoryData={categoryData} expenseCount={expenses.length} />
          </Suspense>
        ) : (
          <div className="glass rounded-2xl p-6 flex flex-col items-center justify-center text-center min-h-[200px]">
            <TrendingDown className="w-8 h-8 text-white/10 mb-3" />
            <p className="text-sm text-white/30">No expense data yet</p>
          </div>
        )}

        <div className="glass rounded-2xl p-6">
          <h3 className="text-base font-semibold text-white mb-1">Recent Expenses</h3>
          <p className="text-xs text-white/40 mb-4">Last {Math.min(expenses.length, 8)} entries</p>
          {expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <p className="text-sm text-white/30">No expenses recorded</p>
              <button onClick={() => setShowForm(true)} className="text-xs text-titan-cyan mt-2 hover:text-titan-cyan/80 transition-colors flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add your first expense
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.slice(0, 8).map(exp => (
                <div key={exp.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{exp.description}</p>
                    <p className="text-xs text-white/30 capitalize">{exp.category}{exp.vendor ? ` · ${exp.vendor}` : ""} · {formatMonthDay(exp.date)}</p>
                  </div>
                  <p className="text-sm font-semibold text-red-400 flex-shrink-0 ml-3 tabular-nums">-${(exp.amount || 0).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) setForm(BLANK_EXPENSE); }}>
        <DialogContent className="bg-[#1A1A1C] border-white/5 text-white max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="text-white text-lg">Add Expense</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <FormField label="Description" value={form.description} onChange={e => f("description", e.target.value)} placeholder="e.g. Fuel fill-up" />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Amount ($)" type="number" value={form.amount} onChange={e => f("amount", parseFloat(e.target.value) || 0)} />
              <FormField label="Date" type="date" value={form.date} onChange={e => f("date", e.target.value)} />
            </div>
            <FormField label="Category">
              <NativeSelect
                value={form.category}
                onValueChange={v => f("category", v)}
                placeholder="Category"
                options={EXPENSE_CATS.map(c => ({ value: c, label: c }))}
                className="mt-1"
              />
            </FormField>
            <FormField label="Vendor" value={form.vendor} onChange={e => f("vendor", e.target.value)} placeholder="Optional" />

            {/* Receipt Upload */}
            <div>
              <label className="text-xs text-white/50 mb-2 block">Receipt Photo</label>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleReceiptUpload} />
              {form.receipt_url ? (
                <div className="relative rounded-xl overflow-hidden border border-white/10">
                  <img src={form.receipt_url} alt="Receipt" className="w-full h-40 object-cover" />
                  <button onClick={() => f("receipt_url", "")}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="w-full h-24 rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-2 hover:border-titan-cyan/40 hover:bg-titan-cyan/5 transition-all disabled:opacity-50">
                  {uploading ? (
                    <div className="w-5 h-5 border-2 border-titan-cyan/30 border-t-titan-cyan rounded-full animate-spin" />
                  ) : <>
                    <Camera className="w-5 h-5 text-white/30" />
                    <span className="text-xs text-white/30">Tap to attach receipt</span>
                  </>}
                </button>
              )}
            </div>

            <Button onClick={handleSave} disabled={saving || !form.description || !form.amount}
              className="w-full bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-11 disabled:opacity-50">
              {saving ? "Saving…" : "Save Expense"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}