import React, { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { CreditCard } from "lucide-react";
import { api } from "@/api/apiClient";
import { useEntityRecord } from "@/hooks/useEntityRecord";
import { motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/shared/StatusBadge";
import PageHeader from "@/components/shared/PageHeader";
import PageShell from "@/components/shared/PageShell";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import DeleteButton from "@/components/shared/DeleteButton";
import { formatMonthDayYear } from "@/lib/date-utils";
import { toast } from "@/components/ui/use-toast";

const STATUS_OPTIONS = ["draft", "sent", "viewed", "partial", "overdue", "cancelled"];
// "paid" is webhook/admin only — never set from the browser

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: invoice, loading, error, reload } = useEntityRecord("Invoice", id);
  const [saving, setSaving] = useState(false);

  const updateStatus = async (status) => {
    if (status === "paid") {
      toast({
        variant: "destructive",
        title: "Webhook only",
        description: "Collect payment to mark this invoice paid — status comes from Stripe.",
      });
      return;
    }
    setSaving(true);
    try {
      await api.entities.Invoice.update(id, { status });
      reload();
      toast({ title: "Status updated" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't update status",
        description: err?.message || "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader variant="detail" label="Loading invoice" />;
  if (error) {
    return (
      <ErrorState
        title="Couldn't load invoice"
        message="This invoice may not exist or you may not have access."
        onRetry={reload}
      />
    );
  }
  if (!invoice) {
    return <div className="p-8 text-muted-foreground text-center" role="status">Invoice not found.</div>;
  }

  return (
    <PageShell maxWidth="md">
      <PageHeader
        title={invoice.invoice_number || "Draft invoice"}
        subtitle={invoice.customer_name || "Customer"}
        breadcrumbs={[
          { label: "Invoices", to: "/invoices" },
          { label: invoice.invoice_number || "Draft" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={invoice.status} />
            <DeleteButton
              label={invoice.invoice_number || "this invoice"}
              onDelete={async () => {
                await api.entities.Invoice.delete(id);
                toast({ title: "Invoice deleted" });
                navigate("/invoices", { replace: true });
              }}
            />
          </div>
        }
      />
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="titan-surface p-6 mb-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-1">Due Date</p>
              <p className="text-foreground font-medium">{invoice.due_date ? formatMonthDayYear(invoice.due_date) : "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">Created</p>
              <p className="text-foreground font-medium">{formatMonthDayYear(invoice.created_date)}</p>
            </div>
          </div>
        </div>

        {/* Line items */}
        {invoice.line_items?.length > 0 && (
          <div className="titan-surface p-5 mb-4">
            <p className="text-xs text-muted-foreground font-medium mb-3">Line Items</p>
            <div className="space-y-3">
              {invoice.line_items.map((item, i) => (
                <div key={i} className="flex justify-between items-center gap-4 min-h-[44px]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{item.description}</p>
                    <p className="text-xs text-muted-foreground">{item.quantity} × ${(item.unit_price || 0).toFixed(2)}</p>
                  </div>
                  <p className="text-sm font-semibold text-foreground tabular-nums flex-shrink-0">${(item.total || 0).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totals */}
        <div className="titan-surface p-5 mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground tabular-nums">${(invoice.subtotal || 0).toFixed(2)}</span>
          </div>
          {invoice.tax_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Tax ({invoice.tax_rate}%)
                {invoice.tax_snapshot?.jurisdictionLabel
                  ? ` · ${invoice.tax_snapshot.jurisdictionLabel}`
                  : ""}
              </span>
              <span className="text-foreground tabular-nums">${Number(invoice.tax_amount || 0).toFixed(2)}</span>
            </div>
          )}
          {invoice.job_location?.city || invoice.job_city ? (
            <p className="text-[11px] text-muted-foreground">
              Job Location:{" "}
              {[
                invoice.job_location?.city || invoice.job_city,
                invoice.job_location?.state || invoice.job_state,
                invoice.job_location?.zip || invoice.job_zip,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          ) : null}
          <div className="flex justify-between text-lg font-bold border-t border-border pt-2">
            <span className="text-foreground">Total</span>
            <span className="text-titan-cyan tabular-nums">${Number(invoice.total || 0).toFixed(2)}</span>
          </div>
          {Number(invoice.balance_due) > 0 && Number(invoice.balance_due) !== Number(invoice.total) && (
            <div className="flex justify-between text-sm">
              <span className="text-titan-amber">Balance Due</span>
              <span className="text-titan-amber tabular-nums font-semibold">${Number(invoice.balance_due || 0).toFixed(2)}</span>
            </div>
          )}
        </div>

        {invoice.status !== "paid" && invoice.status !== "cancelled" && (
          <div className="mb-4">
            <Button
              type="button"
              className="w-full font-semibold h-11"
              onClick={() => navigate("/payments", {
                state: {
                  amount: invoice.balance_due > 0 ? invoice.balance_due : invoice.total,
                  customer_name: invoice.customer_name || "",
                  invoice_id: invoice.id,
                },
              })}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Collect payment
            </Button>
          </div>
        )}

        {/* Status update */}
        <div className="titan-surface p-5">
          <p className="text-xs text-muted-foreground font-medium mb-3">Update Status</p>
          <Select value={invoice.status} onValueChange={updateStatus} disabled={saving}>
            <SelectTrigger className="bg-muted border-border text-foreground rounded-xl h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-muted border-border">
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {invoice.notes && (
          <div className="titan-surface p-5 mt-4">
            <p className="text-xs text-muted-foreground font-medium mb-2">Notes</p>
            <p className="text-sm text-foreground/90">{invoice.notes}</p>
          </div>
        )}
      </motion.div>
    </PageShell>
  );
}