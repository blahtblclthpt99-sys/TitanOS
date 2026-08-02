import React, { useMemo } from "react";
import { useParams, Link } from "react-router";
import { Download, Printer } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { getReportShare } from "@/lib/export/share";
import { downloadTextFile } from "@/lib/export/download";
import { openPrintableReport } from "@/lib/export/pdf";

/**
 * Device share snapshot viewer — printable / CSV download.
 */
export default function ShareReport() {
  const { token } = useParams();
  const snap = useMemo(() => getReportShare(token), [token]);

  if (!snap) {
    return (
      <PageShell maxWidth="md">
        <PageHeader title="Shared report" subtitle="Link missing or expired" />
        <EmptyState
          title="Report not found"
          description="Share links live on the device that created them and expire after 7 days."
          actionLabel="Open Reports"
          actionTo="/reports"
        />
      </PageShell>
    );
  }

  const columns = (snap.columns || []).map((label, i) => ({
    label,
    value: (row) => (Array.isArray(row) ? row[i] : row?.[i]) ?? "",
  }));
  const rows = snap.rows || [];

  return (
    <PageShell maxWidth="lg">
      <PageHeader
        title={snap.title}
        subtitle={`${snap.subtitle || "Shared report"} · expires ${new Date(snap.expires_at).toLocaleDateString()}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] gap-1"
              onClick={() =>
                openPrintableReport(
                  { title: snap.title, subtitle: snap.subtitle, columns, rows },
                  { autoprint: true }
                )
              }
            >
              <Printer className="w-4 h-4" /> Print / PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] gap-1"
              onClick={() => downloadTextFile(`${snap.module || "report"}.csv`, snap.csv || "", "text/csv;charset=utf-8")}
            >
              <Download className="w-4 h-4" /> CSV
            </Button>
          </div>
        }
      />
      <p className="text-xs text-muted-foreground mb-4">
        Device share link — not a public cloud URL. <Link className="underline" to="/reports">Back to Reports</Link>
      </p>
      <div className="titan-surface overflow-x-auto print:shadow-none">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              {(snap.columns || []).map((c) => (
                <th key={c} className="px-3 py-2 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border/60">
                {(Array.isArray(row) ? row : []).map((cell, j) => (
                  <td key={j} className="px-3 py-2 text-foreground">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
