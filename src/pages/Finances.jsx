import React, { useState, useRef, Suspense, lazy } from "react";
import { useNavigate } from "react-router";
import { api } from "@/api/apiClient";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, TrendingDown, Receipt, Camera, X, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import NativeSelect from "@/components/shared/NativeSelect";
import PageHeader from "@/components/shared/PageHeader";
import FormField from "@/components/shared/FormField";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import ExportMenu from "@/components/shared/ExportMenu";
import { toast } from "@/components/ui/use-toast";
import { useEntityData } from "@/hooks/useEntityData";
import { todayISO, formatMonthDay } from "@/lib/date-utils";
import { buildFinanceSummary, buildExpenseCategoryData } from "@/lib/finance-metrics";
import { financesExportSpec } from "@/lib/export/moduleSpecs";
import { formatCurrency } from "@/lib/formatCurrency";
import { EXPENSE_CATEGORIES } from "@/lib/platformConstants";

const FinancesExpenseChart = lazy(() => import("@/components/charts/FinancesExpenseChart"));

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
  const navigate = useNavigate();
  const { data: [invoices, expenses, estimates], loading, error, reload } = useEntityData([
    { entity: "Invoice", method: "list", args: ["-created_date", 100] },
    { entity: "Expense", method: "list", args: ["-date", 100] },
    { entity: "Estimate", method: "list", args: ["-created_date", 100] },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_EXPENSE);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const f = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      f("receipt_url", file_url);
      toast({ title: "Receipt attached" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't upload receipt",
        description: err?.message || "Try again.",
      });
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!form.description || !form.amount) return;
    setSaving(true);
    try {
      await api.entities.Expense.create({
        ...form,
        amount: Number(form.amount) || 0,
        business_use_percent: Math.min(100, Math.max(0, Number(form.business_use_percent) || 100)),
      });
      toast({ title: "Expense saved", description: "It will show in Finances and Tax Center." });
      setForm(BLANK_EXPENSE);
      setShowForm(false);
      reload();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't save expense",
        description: err?.message || "Check the details and try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const { totalRevenue, totalExpenses, profit, outstanding } = buildFinanceSummary(invoices, expenses);
  const categoryData = buildExpenseCategoryData(expenses);
  const approvedEstimates = estimates.filter((estimate) => /approved|accepted/i.test(String(estimate.status || "")));
  const approvedEstimateValue = approvedEstimates.reduce((sum, estimate) => sum + Number(estimate.total || 0), 0);
  const readyInvoices = invoices.filter((invoice) => !/paid|void|cancel/i.test(String(invoice.status || "")));
  const paidInvoices = invoices.filter((invoice) => /paid/i.test(String(invoice.status || "")));

  const summaryCards = [
    {
      label: "Revenue",
      value: formatCurrency(totalRevenue),
      icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      onClick: () => navigate("/invoices"),
    },
    {
      label: "Expenses",
      value: formatCurrency(totalExpenses),
      icon: TrendingDown,
      color: "text-red-400",
      bg: "bg-red-400/10",
      onClick: () => setShowForm(true),
    },
    {
      label: profit >= 0 ? "Profit" : "Loss",
      value: formatCurrency(Math.abs(profit)),
      icon: DollarSign,
      color: profit >= 0 ? "text-emerald-400" : "text-red-400",
      bg: profit >= 0 ? "bg-emerald-400/10" : "bg-red-400/10",
      onClick: () => navigate("/reports"),
    },
    {
      label: "Outstanding",
      value: formatCurrency(outstanding),
      icon: Receipt,
      color: "text-titan-amber",
      bg: "bg-titan-amber/10",
      onClick: () => navigate("/invoices"),
    },
  ];

  if (loading) return <PageLoader variant="list" label="Loading finances" />;
  if (error) return <ErrorState title="Couldn't load finances" onRetry={reload} />;

  return (
    <div className="titan-money-flow-page page-pad max-w-7xl mx-auto">
      <PageHeader
        eyebrow="Money"
        title="Money Flow"
        subtitle="Estimate → invoice → payment → profit. See what is approved, what is ready to collect, and what has landed."
        onAdd={() => setShowForm(true)}
        addLabel="Add Expense"
        actions={<ExportMenu spec={financesExportSpec(invoices, expenses)} />}
      />

      <section className="titan-money-flow-rail" aria-label="Money flow status">
        <button type="button" className="titan-money-stage text-left" onClick={() => navigate("/estimates")}>
          <p className="titan-money-kicker">Estimate approved</p>
          <p className="titan-money-value">{formatCurrency(approvedEstimateValue)}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {approvedEstimates.length} approved estimate{approvedEstimates.length === 1 ? "" : "s"}
          </p>
        </button>
        <button type="button" className="titan-money-stage text-left" data-tone="purple" onClick={() => navigate("/invoices")}>
          <p className="titan-money-kicker">Invoice ready</p>
          <p className="titan-money-value">{formatCurrency(outstanding)}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {readyInvoices.length} invoice{readyInvoices.length === 1 ? "" : "s"} open
          </p>
        </button>
        <button type="button" className="titan-money-stage text-left" data-tone="success" onClick={() => navigate("/payments")}>
          <p className="titan-money-kicker">Paid</p>
          <p className="titan-money-value">{formatCurrency(totalRevenue)}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {paidInvoices.length} paid invoice{paidInvoices.length === 1 ? "" : "s"}
          </p>
        </button>
      </section>

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => navigate("/receipts")}
          className="w-full titan-surface p-4 border border-border flex items-center gap-3 text-left titan-surface-interactive"
        >
          <div className="w-10 h-10 rounded-xl bg-titan-cyan/10 flex items-center justify-center">
            <ScanLine className="w-5 h-5 text-titan-cyan" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Scan a receipt</p>
            <p className="text-xs text-muted-foreground">OCR → tax-deductible expense</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => navigate("/tax-center")}
          className="w-full titan-surface p-4 border border-border flex items-center gap-3 text-left titan-surface-interactive"
        >
          <div className="w-10 h-10 rounded-xl bg-titan-amber/10 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-titan-amber" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Tax Center</p>
            <p className="text-xs text-muted-foreground">Mileage, write-offs & quarterly estimates</p>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {summaryCards.map((card, i) => (
          <motion.button
            type="button"
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            onClick={card.onClick}
            className="titan-surface p-5 text-left titan-surface-interactive"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.bg}`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{card.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{card.label}</p>
          </motion.button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {categoryData.length > 0 ? (
          <Suspense
            fallback={
              <div className="titan-surface p-6 min-h-[200px] flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-titan-cyan/30 border-t-titan-cyan rounded-full animate-spin" />
              </div>
            }
          >
            <FinancesExpenseChart categoryData={categoryData} expenseCount={expenses.length} />
          </Suspense>
        ) : (
          <EmptyState
            className="min-h-[200px] py-8"
            icon={TrendingDown}
            title="No expense data yet"
            description="Log purchases and receipts so category charts and tax-ready totals stay accurate."
            actionLabel="Add expense"
            onAction={() => setShowForm(true)}
          />
        )}

        <div className="titan-surface p-6">
          <h3 className="text-base font-semibold text-foreground mb-1">Recent Expenses</h3>
          <p className="text-xs text-muted-foreground mb-4">Last {Math.min(expenses.length, 8)} entries</p>
          {expenses.length === 0 ? (
            <EmptyState
              className="h-auto py-8"
              title="No expenses recorded"
              description="Add your first expense to start tracking spend."
              actionLabel="Add expense"
              onAction={() => setShowForm(true)}
            />
          ) : (
            <div className="space-y-2">
              {expenses.slice(0, 8).map((exp) => (
                <div
                  key={exp.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{exp.description}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {exp.category}
                      {exp.vendor ? ` · ${exp.vendor}` : ""} · {formatMonthDay(exp.date)}
                      {exp.is_tax_deductible === false ? " · non-deductible" : ""}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-red-400 flex-shrink-0 ml-3 tabular-nums">
                    -{formatCurrency(exp.amount || 0)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={showForm}
        onOpenChange={(v) => {
          setShowForm(v);
          if (!v) setForm(BLANK_EXPENSE);
        }}
      >
        <DialogContent className="bg-card border-border text-foreground max-w-md ">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg">Add Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <FormField
              label="Description"
              value={form.description}
              onChange={(e) => f("description", e.target.value)}
              placeholder="e.g. Fuel fill-up"
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Amount ($)"
                type="number"
                value={form.amount}
                onChange={(e) => f("amount", parseFloat(e.target.value) || 0)}
              />
              <FormField label="Date" type="date" value={form.date} onChange={(e) => f("date", e.target.value)} />
            </div>
            <FormField label="Category">
              <NativeSelect
                value={form.category}
                onValueChange={(v) => f("category", v)}
                placeholder="Category"
                options={EXPENSE_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
                className="mt-1"
              />
            </FormField>
            <FormField
              label="Vendor"
              value={form.vendor}
              onChange={(e) => f("vendor", e.target.value)}
              placeholder="Optional"
            />
            <label className="flex items-center gap-2 text-sm text-foreground/90">
              <input
                type="checkbox"
                checked={form.is_tax_deductible !== false}
                onChange={(e) => f("is_tax_deductible", e.target.checked)}
                className="rounded border-border"
              />
              Tax deductible
            </label>
            {form.is_tax_deductible !== false && (
              <FormField
                label="Business use %"
                type="number"
                min="0"
                max="100"
                value={form.business_use_percent}
                onChange={(e) => f("business_use_percent", parseFloat(e.target.value) || 0)}
              />
            )}

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Receipt Photo</label>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleReceiptUpload} />
              {form.receipt_url ? (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={form.receipt_url} alt="Receipt" className="w-full h-40 object-cover" />
                  <button
                    type="button"
                    aria-label="Remove receipt"
                    onClick={() => f("receipt_url", "")}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                  >
                    <X className="w-4 h-4 text-foreground" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  aria-label="Attach receipt photo"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full h-24 rounded-xl border border-dashed border-border flex flex-col items-center justify-center gap-2 hover:border-titan-cyan/40 hover:bg-titan-cyan/5 transition-all disabled:opacity-50"
                >
                  {uploading ? (
                    <div className="w-5 h-5 border-2 border-titan-cyan/30 border-t-titan-cyan rounded-full animate-spin" />
                  ) : (
                    <>
                      <Camera className="w-5 h-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Tap to attach receipt</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || !form.description || !form.amount}
              className="w-full bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-11 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Expense"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
