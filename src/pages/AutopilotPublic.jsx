import React, { useEffect } from "react";
import { ArrowRight, CheckCircle2, Eye, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import { trackAutopilotEvent } from "@/lib/autopilotTelemetry";

const SAMPLE_ROWS = [
  { id: "INV-2041", customer: "Sample customer A", age: "34 days overdue", balance: "$840.00" },
  { id: "INV-2053", customer: "Sample customer B", age: "18 days overdue", balance: "$465.00" },
  { id: "INV-2060", customer: "Sample customer C", age: "9 days overdue", balance: "$220.00" },
];

function ExamplePreview() {
  return (
    <section className="titan-surface overflow-hidden border border-titan-cyan/25">
      <div className="border-b border-border bg-titan-cyan/5 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-titan-cyan">Example preview · sample data</p>
          <h2 className="text-lg font-semibold mt-1">Recovery Command Center</h2>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-300">
          Owner approval required
        </span>
      </div>

      <div className="p-5 space-y-3">
        {SAMPLE_ROWS.map((row, index) => (
          <div key={row.id} className="rounded-xl border border-border bg-card/70 p-4 flex items-center gap-3">
            <div className="h-9 w-9 shrink-0 rounded-lg bg-titan-cyan/10 text-titan-cyan flex items-center justify-center font-semibold text-sm">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{row.customer}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{row.id} · {row.age}</p>
            </div>
            <p className="font-semibold tabular-nums">{row.balance}</p>
          </div>
        ))}

        <div className="grid sm:grid-cols-3 gap-3 pt-2">
          <div className="rounded-xl bg-muted/45 p-3">
            <p className="text-xs text-muted-foreground">1. Detect</p>
            <p className="text-sm font-medium mt-1">Find overdue balances</p>
          </div>
          <div className="rounded-xl bg-muted/45 p-3">
            <p className="text-xs text-muted-foreground">2. Approve</p>
            <p className="text-sm font-medium mt-1">Choose exact recipients</p>
          </div>
          <div className="rounded-xl bg-muted/45 p-3">
            <p className="text-xs text-muted-foreground">3. Execute</p>
            <p className="text-sm font-medium mt-1">Send + audit every result</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AutopilotPublic() {
  useEffect(() => {
    void trackAutopilotEvent("preview_view", { mode: "public" });
  }, []);

  return (
    <div className="page-pad max-w-5xl mx-auto pb-24">
      <PageHeader
        title="Titan Autopilot"
        subtitle="Turn overdue invoices into approved, trackable follow-ups — without spending your day chasing payments."
      />

      <section className="titan-surface p-5 sm:p-7 mb-5 border border-titan-cyan/25">
        <div className="max-w-3xl">
          <p className="text-xs font-medium text-titan-cyan">Invoice recovery, with you in control</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-2">
            Approve the customers. Titan handles the repetitive follow-up.
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-3 leading-relaxed">
            Titan Autopilot finds eligible overdue invoices, lets you approve up to 10 recipients, sends one factual payment reminder, and records the outcome. If an invoice is paid before execution, the reminder is stopped automatically.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mt-6">
          <div className="rounded-xl border border-border bg-card/70 p-4">
            <Eye className="w-5 h-5 text-titan-cyan" aria-hidden />
            <p className="font-medium mt-3">Nothing hidden</p>
            <p className="text-xs text-muted-foreground mt-1">You see and approve every recipient before Titan acts.</p>
          </div>
          <div className="rounded-xl border border-border bg-card/70 p-4">
            <ShieldCheck className="w-5 h-5 text-titan-cyan" aria-hidden />
            <p className="font-medium mt-3">Paid-invoice safety stop</p>
            <p className="text-xs text-muted-foreground mt-1">Eligibility is checked again immediately before delivery.</p>
          </div>
          <div className="rounded-xl border border-border bg-card/70 p-4">
            <CheckCircle2 className="w-5 h-5 text-titan-cyan" aria-hidden />
            <p className="font-medium mt-3">Auditable execution</p>
            <p className="text-xs text-muted-foreground mt-1">Sent, failed, skipped, and retry-needed outcomes stay visible instead of disappearing.</p>
          </div>
        </div>
      </section>

      <ExamplePreview />

      <section className="mt-5 rounded-2xl border border-border bg-card/60 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="font-semibold">Use your real invoice data</p>
          <p className="text-sm text-muted-foreground mt-1">Sign in to see eligible overdue invoices and approve your first recovery batch.</p>
        </div>
        <Button
          className="min-h-11 shrink-0 gap-2"
          onClick={() => {
            window.location.href = "/login";
          }}
        >
          Open Titan Autopilot <ArrowRight className="w-4 h-4" aria-hidden />
        </Button>
      </section>

      <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
        Titan Autopilot is a follow-up workflow, not a collections agency and not a payment guarantee. It only works with customer records you already own and invoices you select.
      </p>
    </div>
  );
}
