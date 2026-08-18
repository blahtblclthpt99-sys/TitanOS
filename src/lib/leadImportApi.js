import { createLead, listLeads } from "@/lib/leadsApi";

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

/** Parse simple CSV: name,email,phone,notes (header optional). */
export function parseLeadsCsv(text = "") {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const split = (line) => {
    const cells = [];
    let current = "";
    let quoted = false;
    for (const char of line) {
      if (char === '"') {
        quoted = !quoted;
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

  const rows = [];
  for (let index = start; index < lines.length; index += 1) {
    const [name, email, phone, notes] = split(lines[index]);
    if (!name && !email && !phone) continue;
    rows.push({
      name: name || email || "Lead",
      email: email || "",
      phone: phone || "",
      notes: notes || "",
      source: "csv_import",
    });
  }
  return rows;
}

export async function importLeadsFromCsv(user, csvText) {
  if (!user?.id) throw new Error("Sign in to import leads.");
  const parsed = parseLeadsCsv(csvText);
  const existing = await listLeads(user.id).catch(() => []);
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
