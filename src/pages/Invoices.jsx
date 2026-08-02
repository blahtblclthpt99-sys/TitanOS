import React, { useState, useEffect } from "react";
import { api } from "@/api/apiClient";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { Receipt, Search, Plus, Trash2 } from "lucide-react";
import DeleteButton from "@/components/shared/DeleteButton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import NativeSelect from "@/components/shared/NativeSelect";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import FilterChip from "@/components/shared/FilterChip";
import StatusBadge from "@/components/shared/StatusBadge";
import FormField from "@/components/shared/FormField";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import VirtualList, { shouldVirtualize } from "@/components/shared/VirtualList";
import ExportMenu from "@/components/shared/ExportMenu";
import { useEntityData } from "@/hooks/useEntityData";
import { addDaysISO, formatMonthDayYear } from "@/lib/date-utils";
import { toast } from "@/components/ui/use-toast";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { listItemMotion } from "@/lib/listMotion";
import { sanitizeLineItems, totalsFromTaxResult } from "@/lib/moneyDocument";
import JobLocationFields from "@/components/location/JobLocationFields";
import { invoicesExportSpec } from "@/lib/export/moduleSpecs";
import {
  emptyJobLocation,
  jobLocationFromCustomer,
  normalizeJobLocation,
} from "@/lib/jobLocation";
import { calculateDocumentTax } from "@/lib/taxEngine";

const BLANK_FORM = {
  customer_id: "",
  customer_name: "",
  notes: "",
  tax_exempt: false,
  due_date: addDaysISO(30),
};

const BLANK_LINE = { description: "", quantity: 1, unit_price: 0, total: 0 };

function customerDisplayName(c) {
  if (!c) return "";
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return name || c.company_name || c.email || "Customer";
}

export default function Invoices({ isActive = true }) {
  const reduceMotion = usePrefersReducedMotion();
  const navigate = useNavigate();
  const { data: [invoices, customers], loading, error, reload } = useEntityData([
    { entity: "Invoice",  method: "list", args: ["-created_date", 100] },
    { entity: "Customer", method: "list", args: ["-created_date", 100] },
  ], { enabled: isActive });

  const [search, setSearch]       = useState("");
  const [statusFilter, setStatus] = useState("all");
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(BLANK_FORM);
  const [lineItems, setLineItems] = useState([{ ...BLANK_LINE }]);
  const [jobLocation, setJobLocation] = useState(() => emptyJobLocation());
  const [taxPreview, setTaxPreview] = useState(null);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const deepId = params.get("id");
    if (deepId) {
      navigate(`/invoices/${deepId}`, { replace: true });
      return;
    }
    if (params.get("new") !== "1") return;

    setShowForm(true);
    try {
      const raw = sessionStorage.getItem("titanos_estimator_draft");
      if (!raw) return;
      const draft = JSON.parse(raw);
      const est = draft?.estimate;
      const inputs = draft?.inputs || {};
      if (!est) return;
      setForm((prev) => ({
        ...prev,
        notes: prev.notes || `From Job Estimator (${inputs.service_type || "service"}): suggested $${Number(est.suggested_price || 0).toLocaleString()}`,
      }));
      setLineItems([
        {
          description: `${inputs.service_type || "Service"} — estimated job`,
          quantity: 1,
          unit_price: Number(est.suggested_price) || 0,
          total: Number(est.suggested_price) || 0,
        },
      ]);
      sessionStorage.removeItem("titanos_estimator_draft");
    } catch {
      /* ignore */
    }
  }, [navigate]);

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const updateLine = (idx, field, raw) => {
    const value = field === "description" ? raw : (parseFloat(raw) || 0);
    setLineItems(prev => {
      const items = prev.map((item, i) => i === idx ? { ...item, [field]: value } : item);
      items[idx] = { ...items[idx], total: items[idx].quantity * items[idx].unit_price };
      return [...items];
    });
  };

  const subtotal = lineItems.reduce((s, i) => s + (i.total || 0), 0);
  const liveTax =
    taxPreview ||
    calculateDocumentTax({
      lineItems,
      jobLocation,
      taxExempt: Boolean(form.tax_exempt),
    });
  const taxAmount = liveTax.taxAmount || 0;
  const total = liveTax.total || subtotal;

  const handleSave = async () => {
    if (!form.customer_name?.trim()) {
      toast({ title: "Customer name required", variant: "destructive" });
      return;
    }
    const lines = sanitizeLineItems(lineItems);
    if (!lines.ok) {
      toast({ title: "Invalid line items", description: lines.error, variant: "destructive" });
      return;
    }
    const loc = normalizeJobLocation(jobLocation);
    if (!loc.city && !loc.zip && !loc.address) {
      toast({
        title: "Job Location required",
        description: "Enter where the work happens so sales tax can be calculated.",
        variant: "destructive",
      });
      return;
    }
    const tax = calculateDocumentTax({
      lineItems: lines.items,
      jobLocation: loc,
      taxExempt: Boolean(form.tax_exempt),
      recalculate: true,
    });
    if (!tax.ok && !form.tax_exempt) {
      toast({
        title: "Could not resolve tax",
        description: tax.error || "Add a matching Tax Rule or refine Job Location.",
        variant: "destructive",
      });
      return;
    }
    const totals = totalsFromTaxResult(tax);
    if (totals.total <= 0) {
      toast({ title: "Total must be greater than $0", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.entities.Invoice.create({
        ...form,
        customer_name: form.customer_name.trim(),
        address: loc.address || "",
        job_city: loc.city,
        job_state: loc.state,
        job_zip: loc.zip,
        job_county: loc.county,
        job_country: loc.country,
        job_lat: loc.lat,
        job_lng: loc.lng,
        job_location: loc,
        tax_exempt: Boolean(form.tax_exempt),
        tax_rate: totals.taxRate,
        tax_snapshot: totals.taxSnapshot,
        invoice_number: `INV-${Date.now().toString().slice(-6)}`,
        line_items: lines.items,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        total: totals.total,
        balance_due: totals.total,
        status: "draft",
      });
      setForm(BLANK_FORM);
      setLineItems([{ ...BLANK_LINE }]);
      setJobLocation(emptyJobLocation());
      setTaxPreview(null);
      setShowForm(false);
      reload();
      toast({ title: "Invoice created" });
    } catch (err) {
      toast({
        title: "Couldn't save invoice",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const filtered = invoices
    .filter(inv => statusFilter === "all" || inv.status === statusFilter)
    .filter(inv => `${inv.customer_name ?? ""} ${inv.invoice_number ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  if (!isActive && !invoices.length) return null;
  if (loading && !invoices.length) return <PageLoader variant="list" label="Loading invoices" />;
  if (error) return <ErrorState title="Couldn't load invoices" onRetry={reload} />;

  const renderInvoiceRow = (inv) => {
    const label = inv.invoice_number || "Draft invoice";
    const open = () => navigate(`/invoices/${inv.id}`);
    return (
      <div
        role="link"
        tabIndex={0}
        aria-label={`Open ${label} for ${inv.customer_name || "customer"}`}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
        className="titan-surface p-4 titan-surface-interactive cursor-pointer focus-ring titan-surface-interactive"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-sm font-semibold text-foreground">{inv.invoice_number || "Draft"}</p>
              <StatusBadge status={inv.status} />
            </div>
            <p className="text-xs text-muted-foreground">{inv.customer_name} · Due {formatMonthDayYear(inv.due_date)}</p>
          </div>
          <div className="text-right flex-shrink-0 flex items-center gap-1">
            <div>
              <p className="text-lg font-bold text-foreground">${(inv.total || 0).toLocaleString()}</p>
              {inv.balance_due > 0 && inv.balance_due !== inv.total && (
                <p className="text-xs text-titan-amber">Bal: ${inv.balance_due.toLocaleString()}</p>
              )}
            </div>
            <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <DeleteButton
                label={inv.invoice_number || "this invoice"}
                onDelete={async () => {
                  await api.entities.Invoice.delete(inv.id);
                  reload();
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page-pad max-w-7xl mx-auto pb-28 md:pb-10">
      <PageHeader
        title="Invoices"
        subtitle={`${invoices.length} total`}
        onAdd={() => setShowForm(true)}
        addLabel="New Invoice"
        actions={<ExportMenu spec={invoicesExportSpec(invoices)} size="sm" />}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search invoices"
            className="pl-11 bg-card border-border text-foreground rounded-md h-11 placeholder:text-muted-foreground/80"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Invoice status filters">
          {["all", "draft", "sent", "paid", "overdue", "cancelled"].map(s => (
            <FilterChip key={s} active={statusFilter === s} onClick={() => setStatus(s)}>
              {s === "all" ? "All" : s}
            </FilterChip>
          ))}
        </div>
      </div>

      {filtered.length === 0 && !search && statusFilter === "all" ? (
        <EmptyState icon={Receipt} title="No invoices yet" description="Create and send professional invoices to get paid faster." onAction={() => setShowForm(true)} actionLabel="New Invoice" />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matches" description="No invoices match your filter. Try clearing search or status." className="py-12" />
      ) : shouldVirtualize(filtered.length) ? (
        <VirtualList items={filtered} renderItem={renderInvoiceRow} estimateSize={76} />
      ) : (
        <div className="space-y-2">
          {filtered.map((inv, i) => (
            <motion.div key={inv.id} {...listItemMotion(reduceMotion, i)}>
              {renderInvoiceRow(inv)}
            </motion.div>
          ))}
        </div>
      )}

      <Dialog
        open={showForm}
        onOpenChange={(v) => {
          setShowForm(v);
          if (!v) {
            setForm(BLANK_FORM);
            setLineItems([{ ...BLANK_LINE }]);
            setJobLocation(emptyJobLocation());
            setTaxPreview(null);
          }
        }}
      >
        <DialogContent className="bg-card border-border text-foreground max-w-2xl  max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg">New Invoice</DialogTitle>
            <DialogDescription>
              Sales tax uses Job Location (service situs), not your Driver Location.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Customer">
                <NativeSelect
                  value={form.customer_id}
                  onValueChange={(v) => {
                    const c = customers.find((cust) => cust.id === v);
                    const fromCustomer = c ? jobLocationFromCustomer(c) : emptyJobLocation();
                    setForm((prev) => ({
                      ...prev,
                      customer_id: v,
                      customer_name: customerDisplayName(c),
                    }));
                    setJobLocation(fromCustomer);
                  }}
                  placeholder="Select customer"
                  options={customers.map((c) => ({
                    value: c.id,
                    label: customerDisplayName(c),
                  }))}
                  className="mt-1"
                />
              </FormField>
              <FormField
                label="Due Date"
                type="date"
                value={form.due_date}
                onChange={(e) => f("due_date", e.target.value)}
              />
            </div>

            <JobLocationFields
              value={jobLocation}
              onChange={setJobLocation}
              lineItems={lineItems}
              taxExempt={Boolean(form.tax_exempt)}
              onTaxChange={setTaxPreview}
            />

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={Boolean(form.tax_exempt)}
                onChange={(e) => f("tax_exempt", e.target.checked)}
                className="rounded border-border"
              />
              Tax-exempt customer
            </label>

            <div>
              <label className="text-muted-foreground text-xs font-medium block mb-2">Line Items</label>
              <div className="space-y-2">
                {lineItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateLine(idx, "description", e.target.value)}
                      aria-label={`Line ${idx + 1} description`}
                      className="bg-muted border-border text-foreground rounded-md flex-1 text-sm h-9"
                    />
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                      aria-label={`Line ${idx + 1} quantity`}
                      className="bg-muted border-border text-foreground rounded-md w-16 text-sm h-9"
                    />
                    <Input
                      type="number"
                      placeholder="Price"
                      value={item.unit_price}
                      onChange={(e) => updateLine(idx, "unit_price", e.target.value)}
                      aria-label={`Line ${idx + 1} unit price`}
                      className="bg-muted border-border text-foreground rounded-md w-24 text-sm h-9"
                    />
                    <span
                      className="text-sm text-muted-foreground w-20 text-right tabular-nums"
                      aria-label={`Line ${idx + 1} total`}
                    >
                      ${(item.total || 0).toFixed(2)}
                    </span>
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))}
                        className="text-muted-foreground hover:text-red-400 transition-colors focus-ring rounded-md p-1"
                        aria-label={`Remove line item ${idx + 1}`}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setLineItems([...lineItems, { ...BLANK_LINE }])}
                className="flex items-center gap-1 text-xs text-primary mt-3 hover:text-primary/80 transition-colors"
              >
                <Plus className="w-3 h-3" /> Add line item
              </button>
            </div>

            <div className="bg-muted/50 rounded-md p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground tabular-nums">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Tax
                  {form.tax_exempt
                    ? " (exempt)"
                    : liveTax.taxRate
                      ? ` (${liveTax.taxRate}%)`
                      : ""}
                </span>
                <span className="text-foreground tabular-nums">${taxAmount.toFixed(2)}</span>
              </div>
              {liveTax.jurisdiction?.rule?.label ? (
                <p className="text-[11px] text-muted-foreground">
                  Jurisdiction: {liveTax.jurisdiction.rule.label} · from Job Location
                </p>
              ) : null}
              <div className="flex justify-between text-lg font-bold border-t border-border pt-2">
                <span className="text-foreground">Total</span>
                <span className="text-primary tabular-nums">${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs font-medium">Notes</label>
              <Textarea
                value={form.notes}
                onChange={(e) => f("notes", e.target.value)}
                className="bg-muted border-border text-foreground rounded-md min-h-[60px]"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || !form.customer_name}
              className="w-full h-11"
            >
              {saving ? "Creating…" : "Create Invoice"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}