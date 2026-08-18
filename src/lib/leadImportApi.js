import { createLead, listLeads } from "@/lib/leadsApi";

const MAX_CSV_CHARS = 250_000;
const MAX_IMPORT_ROWS = 500;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function leadKey(lead = {}) {
  const email = normalizeEmail(lead.email);
  if (email) return `email:${email}`;
  const phone = normalizePhone(lead.phone);
  if (phone) return `phone:${phone}`;
  return `name:${normalizeName(lead.name)}|${normalizeName(lead.city)}|${normalizeName(lead.state)}`;
}

/** Parse bounded CSV: name,email,phone,notes (header optional). */
export function parseLeadsCsv(text = "") {
  const raw = String(text);
  if (raw.length > MAX_CSV_CHARS) {
    throw new Error("Lead CSV is too large. Keep imports under 250 KB.");
  }

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const split = (line) => {
    const cells = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') {
        if (quoted && line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
        continue;
      }
      if (char === "," && !quoted) {
        cells.push(current.trim());
        current = "";
        continue;
      }
      current += char;
    }
    cells.push(current.trim());
    return cells;
  };

  let start = 0;
  const first = split(lines[0]).map((cell) => cell.toLowerCase());
  const hasHeader = first.includes("name") || first.includes("email") || first.includes("phone");
  if (hasHeader) start = 1;

  if (lines.length - start > MAX_IMPORT_ROWS) {
    throw new Error(`Import at most ${MAX_IMPORT_ROWS} leads at a time.`);
  }

  const rows = [];
  for (let index = start; index < lines.length; index += 1) {
    const [name, email, phone, notes] = split(lines[index]);
    if (!name && !email && !phone) continue;
    rows.push({
      name: String(name || email || "Lead").slice(0, 160),
      email: String(email || "").slice(0, 160),
      phone: String(phone || "").slice(0, 80),
      notes: String(notes || "").slice(0, 2000),
      source: "csv_import",
    });
  }
  return rows;
}

export async function importLeadsFromCsv(user, csvText) {
  if (!user?.id) throw new Error("Sign in to import leads.");
  const parsed = parseLeadsCsv(csvText);
  const existing = await listLeads(user.id);
  const seen = new Set((existing || []).map(leadKey));
  const created = [];
  let skipped = 0;

  for (const row of parsed) {
    const key = leadKey(row);
    if (!key || seen.has(key)) {
      skipped += 1;
      continue;
    }
    created.push(await createLead(user, row));
    seen.add(key);
  }

  return { created, count: created.length, skipped };
}
