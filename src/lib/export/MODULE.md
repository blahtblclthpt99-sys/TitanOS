# MODULE — Export / Reporting

**Public import:** `@/lib/export`  
**UI:** `@/components/shared/ExportMenu`

## Purpose

One export stack for CSV, Excel (SpreadsheetML), PDF-via-print, device share links, and local schedules. Pages supply a **module spec** (columns + rows); they do not reimplement serializers.

## Public API

| Export | Role |
|--------|------|
| `runExport` / `EXPORT_FORMATS` | Orchestrate format |
| `toCsv` / `downloadCsv` | CSV |
| `buildSpreadsheetMl` / `downloadExcelFile` / `sheetFromColumns` | Excel |
| `buildReportHtml` / `openPrintableReport` / `downloadPdfReport` | Print/PDF |
| `createReportShare` / `copyReportShareLink` | Share tokens |
| `listScheduledReports` / `upsertScheduledReport` / … | Local schedules |
| `moduleSpecs` | Per-page column packs (Jobs, Invoices, …) |

## Do not

- Fork SpreadsheetML in driver code — use `@/lib/export/excel`
- Export unbounded row sets (cap in specs / callers)
- Skip `ExportMenu` on History/Reports list pages when adding exports (Estimates, Leads, Payments, Tax, Contracts included)

## Key files

`csv.js`, `excel.js`, `pdf.js`, `runExport.js`, `moduleSpecs.js`, `share.js`, `schedule.js`, `download.js`
