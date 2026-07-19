/** Shared invoice/expense financial calculations used across Finances and Reports. */

const OPEN_INVOICE_STATUSES = new Set(["sent", "viewed", "overdue", "partial", "open", "pending", "unpaid"]);

export function sumPaidRevenue(invoices = []) {
  return (invoices || [])
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + (Number(i.total) || 0), 0);
}

export function sumExpenses(expenses = []) {
  return (expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

export function sumOutstanding(invoices = []) {
  return (invoices || [])
    .filter((i) => OPEN_INVOICE_STATUSES.has(String(i.status || "").toLowerCase()))
    .reduce((sum, i) => {
      const due = i.balance_due;
      if (due != null && due !== "" && !Number.isNaN(Number(due))) return sum + Number(due);
      return sum + (Number(i.total) || 0);
    }, 0);
}

export function buildExpenseCategoryData(expenses = []) {
  const byCategory = (expenses || []).reduce((acc, e) => {
    const key = e.category || "other";
    acc[key] = (acc[key] || 0) + (Number(e.amount) || 0);
    return acc;
  }, {});

  return Object.entries(byCategory).map(([name, value]) => ({ name, value }));
}

export function buildFinanceSummary(invoices, expenses) {
  const totalRevenue = sumPaidRevenue(invoices);
  const totalExpenses = sumExpenses(expenses);
  const profit = totalRevenue - totalExpenses;
  const outstanding = sumOutstanding(invoices);

  return { totalRevenue, totalExpenses, profit, outstanding };
}
