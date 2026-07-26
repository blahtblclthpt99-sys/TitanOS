/**
 * SpreadsheetML Excel (.xls) — opens in Excel / LibreOffice / Numbers. Zero heavy deps.
 */
import { downloadBlob } from "@/lib/export/download";

function xmlEscape(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cellXml(value, typeHint) {
  if (value == null || value === "") {
    return `<Cell><Data ss:Type="String"></Data></Cell>`;
  }
  if (typeHint === "Number" || (typeof value === "number" && Number.isFinite(value))) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  const s = String(value);
  if (typeHint !== "String" && /^-?\d+(\.\d+)?$/.test(s.trim())) {
    return `<Cell><Data ss:Type="Number">${s.trim()}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${xmlEscape(s)}</Data></Cell>`;
}

function rowXml(values, types = []) {
  return `<Row>${values.map((v, i) => cellXml(v, types[i])).join("")}</Row>`;
}

function worksheetXml(sheet) {
  const name = xmlEscape(sheet.name || "Sheet1").slice(0, 31);
  const rows = (sheet.rows || []).map((r, ri) => rowXml(r, sheet.types?.[ri] || [])).join("");
  return `<Worksheet ss:Name="${name}"><Table>${rows}</Table></Worksheet>`;
}

export function buildSpreadsheetMl(sheets = [], { title = "TitanOS Report" } = {}) {
  const body = (sheets || []).map(worksheetXml).join("");
  return (
    `<?xml version="1.0"?>\r\n` +
    `<?mso-application progid="Excel.Sheet"?>\r\n` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\r\n` +
    ` xmlns:o="urn:schemas-microsoft-com:office:office"\r\n` +
    ` xmlns:x="urn:schemas-microsoft-com:office:excel"\r\n` +
    ` xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\r\n` +
    ` xmlns:html="http://www.w3.org/TR/REC-html40">\r\n` +
    `<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">` +
    `<Title>${xmlEscape(title)}</Title>` +
    `<Author>TitanOS</Author>` +
    `</DocumentProperties>\r\n` +
    body +
    `</Workbook>`
  );
}

/** Build one sheet from column descriptors (same shape as CSV). */
export function sheetFromColumns(name, rows, columns) {
  const header = columns.map((c) => c.label);
  const body = (rows || []).map((row) => columns.map((c) => c.value(row)));
  return { name: name || "Sheet1", rows: [header, ...body] };
}

export function downloadExcelFile(filename, sheets, opts) {
  const xml = typeof sheets === "string" ? sheets : buildSpreadsheetMl(sheets, opts);
  const base = String(filename || "titanos-report");
  const name = /\.xls$/i.test(base) ? base : `${base.replace(/\.xlsx$/i, "")}.xls`;
  return downloadBlob(name, new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" }));
}
