import { createLead } from "@/lib/leadsApi";

/** Parse simple CSV: name,email,phone,notes (header optional). */
export function parseLeadsCsv(text = "") {
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const split = (line) => {
    const cells = [];
    let cur = "";
    let q = false;
    for (const ch of line) {
      if (ch === '"') {
        q = !q;
        continue;
      }
      if (ch === "," && !q) {
        cells.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  };

  let start = 0;
  const first = split(lines[0]).map((c) => c.toLowerCase());
  const hasHeader = first.includes("name") || first.includes("email") || first.includes("phone");
  if (hasHeader) start = 1;

  const rows = [];
  for (let i = start; i < lines.length; i++) {
    const [name, email, phone, notes] = split(lines[i]);
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
  const parsed = parseLeadsCsv(csvText);
  const created = [];
  for (const row of parsed) {
    created.push(await createLead(user, row));
  }
  return { created, count: created.length };
}
