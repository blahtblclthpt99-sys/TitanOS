import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { api } from "@/api/apiClient";
import { useEntityRecord } from "@/hooks/useEntityRecord";
import { motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/shared/StatusBadge";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import { formatMonthDayYear } from "@/lib/date-utils";

const STATUS_OPTIONS = ["draft", "sent", "viewed", "paid", "partial", "overdue", "cancelled"];

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: invoice, loading, error, reload } = useEntityRecord("Invoice", id);
  const [saving, setSaving] = useState(false);

  const updateStatus = async (status) => {
    setSaving(true);
    try {
      await api.entities.Invoice.update(id, { status });
      reload();
    } finally { setSaving(false); }
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
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        {/* Invoice header */}
        <div className="glass rounded-2xl p-6 mb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Invoice</p>
              <h1 className="text-2xl font-bold text-foreground">{invoice.invoice_number || "Draft"}</h1>
              <p className="text-sm text-muted-foreground mt-1">{invoice.customer_name}</p>
            </div>
            <StatusBadge status={invoice.status} />
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm border-t border-border pt-4">
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
          <div className="glass rounded-2xl p-5 mb-4">
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
        <div className="glass rounded-2xl p-5 mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground tabular-nums">${(invoice.subtotal || 0).toFixed(2)}</span>
          </div>
          {invoice.tax_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax ({invoice.tax_rate}%)</span>
              <span className="text-foreground tabular-nums">${invoice.tax_amount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold border-t border-border pt-2">
            <span className="text-foreground">Total</span>
            <span className="text-titan-cyan tabular-nums">${(invoice.total || 0).toFixed(2)}</span>
          </div>
          {invoice.balance_due > 0 && invoice.balance_due !== invoice.total && (
            <div className="flex justify-between text-sm">
              <span className="text-titan-amber">Balance Due</span>
              <span className="text-titan-amber tabular-nums font-semibold">${invoice.balance_due.toFixed(2)}</span>
            </div>
          )}
        </div>

        {invoice.status !== "paid" && invoice.status !== "cancelled" && (
          <div className="mb-4">
            <Button
              type="button"
              className="w-full bg-titan-cyan text-black font-semibold h-11"
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
        <div className="glass rounded-2xl p-5">
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
          <div className="glass rounded-2xl p-5 mt-4">
            <p className="text-xs text-muted-foreground font-medium mb-2">Notes</p>
            <p className="text-sm text-foreground/90">{invoice.notes}</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}