import React, { useMemo, useState } from "react";
import { Download, ChevronDown, FileSpreadsheet, FileText, Printer, Link2, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import { EXPORT_FORMATS, runExport } from "@/lib/export/runExport";
import { upsertScheduledReport } from "@/lib/export/schedule";
import { resolveRows } from "@/lib/export/runExport";

const ICONS = {
  csv: FileText,
  excel: FileSpreadsheet,
  pdf: FileText,
  print: Printer,
  share: Link2,
  schedule: CalendarClock,
};

/**
 * Shared export control — CSV, Excel, PDF (print-to-PDF), Print, Share, Schedule.
 */
export default function ExportMenu({
  spec,
  formats,
  className,
  label = "Export",
  size = "default",
  variant = "outline",
  showSchedule = true,
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const allowed = useMemo(() => {
    const list = formats || spec?.formats || ["csv", "excel", "pdf", "print", "share"];
    return EXPORT_FORMATS.filter((f) => list.includes(f.id));
  }, [formats, spec]);

  const empty = !spec || resolveRows(spec).length === 0;

  const onFormat = async (formatId) => {
    setOpen(false);
    if (!spec) return;
    setBusy(true);
    try {
      const result = await runExport(spec, formatId, { userId: user?.id });
      if (!result.ok) {
        toast({ variant: "destructive", title: "Can't export", description: result.reason });
        return;
      }
      toast({
        title: formatId === "share" ? "Share link ready" : "Export started",
        description: result.hint || result.filename || result.share?.url || "Done.",
      });
    } catch (err) {
      toast({ variant: "destructive", title: "Export failed", description: err?.message || "Try again" });
    } finally {
      setBusy(false);
    }
  };

  const onSchedule = () => {
    setOpen(false);
    if (!user?.id || !spec) {
      toast({ variant: "destructive", title: "Sign in required" });
      return;
    }
    try {
      upsertScheduledReport(user.id, {
        moduleId: spec.id,
        title: spec.title,
        format: "csv",
        cadence: "weekly",
        email: user.email || "",
      });
      toast({
        title: "Weekly export scheduled",
        description:
          "Runs while TitanOS is open on this device. Email delivery is not enabled yet — you'll get an in-app download/toast when due.",
      });
    } catch (err) {
      toast({ variant: "destructive", title: "Couldn't schedule", description: err?.message });
    }
  };

  return (
    <div className={cn("relative inline-flex", className)}>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="gap-1.5 min-h-[44px]"
      >
        <Download className="w-4 h-4" aria-hidden />
        {label}
        <ChevronDown className="w-3.5 h-3.5 opacity-70" aria-hidden />
      </Button>
      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Close export menu" onClick={() => setOpen(false)} />
          <ul
            role="menu"
            className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border border-border bg-card p-1 shadow-lift"
          >
            {allowed.map((f) => {
              const Icon = ICONS[f.id] || FileText;
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={empty && f.id !== "share"}
                    onClick={() => onFormat(f.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted disabled:opacity-40 min-h-[44px]"
                  >
                    <Icon className="w-4 h-4 text-muted-foreground" aria-hidden />
                    {f.label}
                    {f.id === "pdf" ? <span className="ml-auto text-[10px] text-muted-foreground">Print→PDF</span> : null}
                  </button>
                </li>
              );
            })}
            {showSchedule ? (
              <li className="border-t border-border mt-1 pt-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={onSchedule}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted min-h-[44px]"
                >
                  <CalendarClock className="w-4 h-4 text-muted-foreground" aria-hidden />
                  Schedule weekly
                </button>
              </li>
            ) : null}
          </ul>
        </>
      ) : null}
    </div>
  );
}
