import { downloadCsv } from "@/lib/export/csv";
import { downloadExcelFile, sheetFromColumns } from "@/lib/export/excel";
import { downloadPdfReport, openPrintableReport } from "@/lib/export/pdf";
import { copyReportShareLink } from "@/lib/export/share";

export const EXPORT_FORMATS = Object.freeze([
  { id: "csv", label: "CSV" },
  { id: "excel", label: "Excel" },
  { id: "pdf", label: "PDF" },
  { id: "print", label: "Print" },
  { id: "share", label: "Share link" },
]);

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   subtitle?: string,
 *   filename?: string,
 *   columns: { label: string, value: (row: any) => any }[],
 *   rows?: any[],
 *   getRows?: () => any[],
 *   sheets?: { name: string, rows: any[][] }[],
 *   formats?: string[],
 * }} ExportSpec
 */

export function resolveRows(spec) {
  if (typeof spec.getRows === "function") return spec.getRows() || [];
  return spec.rows || [];
}

/**
 * Run a module export. Returns { ok, reason?, filename?, share? }.
 */
export async function runExport(spec, format, { userId } = {}) {
  if (!spec) return { ok: false, reason: "No export defined." };
  const formats = spec.formats || ["csv", "excel", "pdf", "print", "share"];
  if (!formats.includes(format)) {
    return { ok: false, reason: `${format} is not available for this report.` };
  }

  const rows = resolveRows(spec);
  if (!rows.length && format !== "share") {
    return { ok: false, reason: "Nothing to export yet." };
  }

  const base = String(spec.filename || spec.id || "titanos-export").replace(/\.(csv|xls|xlsx|pdf|html)$/i, "");

  if (format === "csv") {
    downloadCsv(`${base}.csv`, rows, spec.columns);
    return { ok: true, filename: `${base}.csv` };
  }

  if (format === "excel") {
    const sheets =
      spec.sheets ||
      [sheetFromColumns(spec.title || "Data", rows, spec.columns)];
    downloadExcelFile(`${base}.xls`, sheets, { title: spec.title });
    return { ok: true, filename: `${base}.xls` };
  }

  if (format === "pdf") {
    downloadPdfReport({ ...spec, rows, filename: base });
    const printed = openPrintableReport({ ...spec, rows }, { autoprint: true });
    return {
      ok: true,
      filename: `${base}-report.html`,
      hint: printed
        ? "Use Print → Save as PDF in the dialog."
        : "Downloaded HTML report — open it and Print → Save as PDF.",
    };
  }

  if (format === "print") {
    const ok = openPrintableReport({ ...spec, rows }, { autoprint: true });
    if (!ok) return { ok: false, reason: "Pop-up blocked — allow pop-ups to print." };
    return { ok: true };
  }

  if (format === "share") {
    if (!userId) return { ok: false, reason: "Sign in to create a share link." };
    const share = await copyReportShareLink(userId, { ...spec, rows });
    return {
      ok: true,
      share,
      hint: "Link copied. Works on this device for 7 days — not a public cloud link yet.",
    };
  }

  return { ok: false, reason: "Unknown format." };
}
