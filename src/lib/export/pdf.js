/**
 * PDF export via printable HTML (browser Save as PDF). No heavy PDF SDK.
 */
import { toCsv } from "@/lib/export/csv";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildReportHtml({ title, subtitle, columns, rows, generatedAt }) {
  const when = generatedAt || new Date().toLocaleString();
  const head = (columns || []).map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
  const body = (rows || [])
    .map((row) => {
      const cells = (columns || []).map((c) => `<td>${escapeHtml(c.value(row))}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title || "TitanOS Report")}</title>
<style>
  @page { margin: 16mm; }
  body { font-family: Georgia, "Times New Roman", serif; color: #111; margin: 24px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; }
  .footer { margin-top: 24px; font-size: 11px; color: #666; }
  @media print {
    body { margin: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="margin-bottom:16px;padding:8px 14px;font-size:14px;">Print / Save as PDF</button>
  <h1>${escapeHtml(title || "TitanOS Report")}</h1>
  <p class="meta">${escapeHtml(subtitle || "")} · Generated ${escapeHtml(when)}</p>
  <table>
    <thead><tr>${head}</tr></thead>
    <tbody>${body || `<tr><td colspan="${(columns || []).length || 1}">No rows</td></tr>`}</tbody>
  </table>
  <p class="footer">TitanOS report · Use your browser Print dialog and choose “Save as PDF” for a PDF file.</p>
  <script>window.addEventListener("load",()=>{ try { /* auto-print optional via ?autoprint=1 */ if(/autoprint=1/.test(location.search)) setTimeout(()=>window.print(),200); } catch(e){} });</script>
</body>
</html>`;
}

/** Open printable/PDF window. Returns false if popup blocked. */
export function openPrintableReport(spec, { autoprint = true } = {}) {
  if (typeof window === "undefined") return false;
  const rows = typeof spec.getRows === "function" ? spec.getRows() : spec.rows || [];
  const html = buildReportHtml({
    title: spec.title,
    subtitle: spec.subtitle,
    columns: spec.columns,
    rows,
  });
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  if (autoprint) {
    try {
      setTimeout(() => w.print(), 300);
    } catch {
      /* user prints manually */
    }
  }
  return true;
}

/** Download a .html report (printable / Save as PDF). Also attach CSV twin for machines. */
export function downloadPdfReport(spec) {
  const rows = typeof spec.getRows === "function" ? spec.getRows() : spec.rows || [];
  const html = buildReportHtml({
    title: spec.title,
    subtitle: spec.subtitle,
    columns: spec.columns,
    rows,
  });
  const base = String(spec.filename || spec.id || "titanos-report").replace(/\.(csv|xls|pdf|html)$/i, "");
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${base}-report.html`;
  a.click();
  URL.revokeObjectURL(url);
  // Companion CSV for systems that expect tabular PDF substitutes
  try {
    const csv = toCsv(rows, spec.columns || []);
    const a2 = document.createElement("a");
    const url2 = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a2.href = url2;
    a2.download = `${base}.csv`;
    // Don't auto-click CSV twin — only HTML for PDF path
    URL.revokeObjectURL(url2);
  } catch {
    /* ignore */
  }
  return true;
}
