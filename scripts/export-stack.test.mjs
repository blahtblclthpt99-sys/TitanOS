import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toCsv, escapeCsvCell } from "../src/lib/export/csv.js";
import { buildSpreadsheetMl, sheetFromColumns } from "../src/lib/export/excel.js";
import { jobsExportSpec, invoicesExportSpec, reportsPackSpec, estimatesExportSpec, leadsExportSpec, paymentsExportSpec, contractsExportSpec, taxCenterExportSpec } from "../src/lib/export/moduleSpecs.js";
import { resolveRows, runExport } from "../src/lib/export/runExport.js";
import { buildReportHtml } from "../src/lib/export/pdf.js";

describe("export CSV", () => {
  it("escapes quotes", () => {
    assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""');
  });

  it("builds header and body", () => {
    const csv = toCsv(
      [{ a: 1, b: 'x,y' }],
      [
        { label: "A", value: (r) => r.a },
        { label: "B", value: (r) => r.b },
      ]
    );
    assert.match(csv, /^"A","B"/);
    assert.match(csv, /"1"/);
    assert.match(csv, /"x,y"/);
  });
});

describe("export Excel SpreadsheetML", () => {
  it("builds workbook with sheet name", () => {
    const xml = buildSpreadsheetMl([{ name: "Jobs", rows: [["Title"], ["Fix"]] }]);
    assert.match(xml, /Excel\.Sheet/);
    assert.match(xml, /ss:Name="Jobs"/);
    assert.match(xml, /Fix/);
  });

  it("sheetFromColumns matches CSV columns", () => {
    const sheet = sheetFromColumns("Data", [{ n: "Ada" }], [{ label: "Name", value: (r) => r.n }]);
    assert.deepEqual(sheet.rows[0], ["Name"]);
    assert.deepEqual(sheet.rows[1], ["Ada"]);
  });
});

describe("export module specs", () => {
  it("jobs and invoices specs expose columns and rows", () => {
    const jobs = jobsExportSpec([{ id: "1", title: "Install", status: "scheduled" }]);
    assert.ok(jobs.columns.length >= 4);
    assert.equal(resolveRows(jobs).length, 1);

    const inv = invoicesExportSpec([{ id: "i1", invoice_number: "INV-1", total: 10, status: "sent" }]);
    assert.equal(resolveRows(inv)[0].invoice_number, "INV-1");
  });

  it("reports pack includes multi-sheet excel data", () => {
    const pack = reportsPackSpec({
      paidInvoices: [{ id: "1", total: 5, status: "paid", customer_name: "A" }],
      expenses: [{ date: "2026-01-01", amount: 2, category: "fuel" }],
      jobs: [{ title: "J", status: "done" }],
      cohorts: [{ month: "2026-01", customers: 1, paying: 1, revenue: 5, conversion: 100 }],
    });
    assert.ok(pack.sheets.length >= 3);
    assert.equal(pack.sheets[0].name, "Revenue");
  });

  it("estimates/leads/payments/contracts/tax specs resolve rows", () => {
    assert.equal(resolveRows(estimatesExportSpec([{ estimate_number: "E-1", total: 9 }])).length, 1);
    assert.equal(resolveRows(leadsExportSpec([{ name: "Ada" }])).length, 1);
    assert.equal(resolveRows(paymentsExportSpec([{ amount: 10, status: "pending" }])).length, 1);
    assert.equal(resolveRows(contractsExportSpec([{ title: "Svc" }])).length, 1);
    assert.ok(taxCenterExportSpec([{ total: 1, status: "paid" }], [{ amount: 2 }]).columns.length >= 3);
  });
});

describe("export PDF/print HTML", () => {
  it("renders printable table markup", () => {
    const html = buildReportHtml({
      title: "Jobs",
      subtitle: "test",
      columns: [{ label: "Title", value: (r) => r.title }],
      rows: [{ title: "A" }],
    });
    assert.match(html, /<h1>Jobs<\/h1>/);
    assert.match(html, /Save as PDF/);
    assert.match(html, /<td>A<\/td>/);
  });
});

describe("runExport empty guard", () => {
  it("refuses empty non-share formats", async () => {
    const result = await runExport(
      { id: "x", title: "X", columns: [{ label: "A", value: () => "" }], rows: [] },
      "csv"
    );
    assert.equal(result.ok, false);
    assert.match(result.reason, /Nothing to export/i);
  });
});
