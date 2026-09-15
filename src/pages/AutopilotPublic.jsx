import React, { useEffect } from "react";
import { ArrowRight, CheckCircle2, Eye, ShieldCheck } from "lucide-react";
import { trackPublicAutopilotPreview } from "@/lib/autopilotPublicTelemetry";

const SAMPLE_ROWS = [
  { id: "INV-2041", customer: "Sample customer A", age: "34 days overdue", balance: "$840.00" },
  { id: "INV-2053", customer: "Sample customer B", age: "18 days overdue", balance: "$465.00" },
  { id: "INV-2060", customer: "Sample customer C", age: "9 days overdue", balance: "$220.00" },
];
const AUTOPILOT_RETURN = encodeURIComponent("/autopilot");

function ExamplePreview() {
  return (
    <section className="titan-surface overflow-hidden border border-titan-cyan/25" aria-labelledby="autopilot-preview-title">
      <div className="border-b border-border bg-titan-cyan/5 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-titan-cyan">Example preview · sample data</p>
          <h2 id="autopilot-preview-title" className="text-lg font-semibold mt-1">Recovery Command Center</h2>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-300">
          Owner approval required
        </span>
      </div>

      <div className="p-5 space-y-3">
        {SAMPLE_ROWS.map((row, index) => (
          <div key={row.id} className="rounded-xl border border-border bg-card/70 p-4 flex items-center gap-3">
            <div className="h-9 w-9 shrink-0 rounded-lg bg-titan-cyan/10 text-titan-cyan flex items-center justify-center font-semibold text-sm" aria-hidden="true">
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
    trackPublicAutopilotPreview();
  }, []);

  return (
    <main className="page-pad max-w-5xl mx-auto pb-24">
      <header className="mb-6 pt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-titan-cyan">Titan Autopilot</p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mt-2 text-foreground">
          Recover overdue revenue without chasing customers manually.
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mt-3 max-w-3xl">
          Turn overdue invoices into approved, trackable follow-ups while keeping every recipient, safety stop, and delivery result visible.
        </p>
      </header>

      <section className="titan-surface p-5 sm:p-7 mb-5 border border-titan-cyan/25">
        <div className="max-w-3xl">
          <p className="text-xs font-medium text-titan-cyan">Invoice recovery, with you in control</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-2">
            Approve the customers. Titan handles the repetitive follow-up.
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground mt-3 leading-relaxed">
            Titan Autopilot finds eligible overdue invoices, lets you approve up to 10 recipients, sends one factual payment reminder, and records the outcome. If an invoice is paid before execution, the reminder is stopped automatically.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mt-6">
          <div className="rounded-xl border border-border bg-card/70 p-4">
            <Eye className="w-5 h-5 text-titan-cyan" aria-hidden="true" />
            <p className="font-medium mt-3">Nothing hidden</p>
            <p className="text-xs text-muted-foreground mt-1">You see and approve every recipient before Titan acts.</p>
          </div>
          <div className="rounded-xl border border-border bg-card/70 p-4">
            <ShieldCheck className="w-5 h-5 text-titan-cyan" aria-hidden="true" />
            <p className="font-medium mt-3">Paid-invoice safety stop</p>
            <p className="text-xs text-muted-foreground mt-1">Eligibility is checked again immediately before delivery.</p>
          </div>
          <div className="rounded-xl border border-border bg-card/70 p-4">
            <CheckCircle2 className="w-5 h-5 text-titan-cyan" aria-hidden="true" />
            <p className="font-medium mt-3">Auditable execution</p>
            <p className="text-xs text-muted-foreground mt-1">Sent, failed, skipped, and retry-needed outcomes stay visible instead of disappearing.</p>
          </div>
        </div>
      </section>

      <ExamplePreview />

      <section className="mt-5 rounded-2xl border border-border bg-card/60 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="font-semibold">Try it with your real invoice data</p>
          <p className="text-sm text-muted-foreground mt-1">Create a TitanOS account or sign in, then come straight back to the Recovery Command Center.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <a
            href={`/register?from_url=${AUTOPILOT_RETURN}`}
            aria-label="Open Titan Autopilot — create account"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Create account <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
          <a
            href={`/login?from_url=${AUTOPILOT_RETURN}`}
            aria-label="Open Titan Autopilot — sign in"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Sign in
          </a>
        </div>
      </section>

      <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
        Titan Autopilot is a follow-up workflow, not a collections agency and not a payment guarantee. It only works with customer records you already own and invoices you select.
      </p>
    </main>
  );
}
