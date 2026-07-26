import { downloadBlob } from "@/lib/export/download";

export function escapeCsvCell(value) {
  const str = value == null ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * @param {object[]} rows
 * @param {{ label: string, value: (row: object) => any }[]} columns
 */
export function toCsv(rows, columns) {
  const header = columns.map((c) => escapeCsvCell(c.label)).join(",");
  const body = (rows || [])
    .map((row) => columns.map((c) => escapeCsvCell(c.value(row))).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

export function downloadCsv(filename, rows, columns) {
  const csv = toCsv(rows, columns);
  const base = String(filename || "titanos-export");
  const name = /\.csv$/i.test(base) ? base : `${base}.csv`;
  return downloadBlob(name, new Blob([csv], { type: "text/csv;charset=utf-8" }));
}
