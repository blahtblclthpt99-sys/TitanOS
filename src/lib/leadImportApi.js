import { createLead } from "@/lib/leadsApi";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const EMAIL_SEARCH_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      current += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += character;
  }
  cells.push(current.trim());
  return cells;
}

function uniqueByEmail(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const email = String(row.email || "").trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email) || seen.has(email)) return false;
    seen.add(email);
    row.email = email;
    return true;
  });
}

export function parseLeadsCsv(text = "") {
  const lines = String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const first = splitCsvLine(lines[0]);
  const normalized = first.map((cell) => cell.toLowerCase().replace(/[^a-z]/g, ""));
  const hasHeader = normalized.some((cell) => ["name", "email", "emailaddress", "phone", "notes", "company"].includes(cell));
  const indexOf = (...names) => normalized.findIndex((cell) => names.includes(cell));
  const indexes = hasHeader ? {
    name: indexOf("name", "fullname", "contactname"),
    email: indexOf("email", "emailaddress"),
    phone: indexOf("phone", "phonenumber", "mobile"),
    notes: indexOf("notes", "note"),
    company: indexOf("company", "business", "businessname"),
  } : { name: 0, email: 1, phone: 2, notes: 3, company: -1 };
  const rows = [];
  for (let lineIndex = hasHeader ? 1 : 0; lineIndex < lines.length; lineIndex += 1) {
    const cells = splitCsvLine(lines[lineIndex]);
    const emailCell = indexes.email >= 0 ? cells[indexes.email] : cells.find((cell) => EMAIL_PATTERN.test(cell));
    const email = String(emailCell || "").trim();
    if (!EMAIL_PATTERN.test(email)) continue;
    const company = indexes.company >= 0 ? cells[indexes.company] || "" : "";
    const name = indexes.name >= 0 ? cells[indexes.name] || "" : "";
    rows.push({ name: name || company || email.split("@")[0], email, phone: indexes.phone >= 0 ? cells[indexes.phone] || "" : "", notes: indexes.notes >= 0 ? cells[indexes.notes] || "" : "", company, source: "file_import" });
  }
  return uniqueByEmail(rows);
}

export function parseLeadsText(text = "") {
  const emails = String(text).match(EMAIL_SEARCH_PATTERN) || [];
  return uniqueByEmail(emails.map((email) => ({ name: email.split("@")[0], email, phone: "", notes: "", company: "", source: "file_import" })));
}

async function extractPdfText(file) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerUrl = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.default;
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }
  return pages.join("\n");
}

export async function parseLeadFile(file) {
  if (!file) return [];
  if (file.size > 10 * 1024 * 1024) throw new Error("Choose a file smaller than 10 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["csv", "txt", "pdf"].includes(extension)) throw new Error("Choose a PDF, CSV, or TXT file.");
  const text = extension === "pdf" ? await extractPdfText(file) : await file.text();
  return extension === "csv" ? parseLeadsCsv(text) : parseLeadsText(text);
}

export async function importLeadRows(user, rows, existingRows = []) {
  const existing = new Set(existingRows.map((row) => String(row.email || "").trim().toLowerCase()).filter(Boolean));
  const pending = uniqueByEmail(rows.map((row) => ({ ...row }))).filter((row) => !existing.has(row.email));
  const created = [];
  for (const row of pending) created.push(await createLead(user, row));
  return { created, count: created.length, skipped: rows.length - pending.length };
}
