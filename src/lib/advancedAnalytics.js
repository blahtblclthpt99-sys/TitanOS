/** Advanced analytics helpers for Reports. */

export function buildCohorts(customers = [], invoices = []) {
  const byMonth = {};
  for (const c of customers) {
    const key = String(c.created_date || c.created_at || "").slice(0, 7);
    if (!key || key.length < 7) continue;
    if (!byMonth[key]) byMonth[key] = { month: key, customers: 0, paying: 0, revenue: 0 };
    byMonth[key].customers += 1;
  }
  for (const inv of invoices) {
    if (inv.status !== "paid") continue;
    const cust = inv.customer_id;
    const created = customers.find((c) => c.id === cust);
    const key = String(created?.created_date || created?.created_at || inv.created_date || "").slice(0, 7);
    if (!key || !byMonth[key]) continue;
    byMonth[key].paying += 1;
    byMonth[key].revenue += Number(inv.total) || 0;
  }
  return Object.values(byMonth)
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-8)
    .map((row) => ({
      ...row,
      conversion: row.customers ? Math.round((row.paying / row.customers) * 100) : 0,
    }));
}

export function exportCsv(filename, rows, columns) {
  const header = columns.map((c) => c.label).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const raw = c.value(row);
          const str = raw == null ? "" : String(raw);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
