/** Shared invoice/expense financial calculations used across Finances and Reports. */

export function sumPaidRevenue(invoices) {
  return invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + (i.total || 0), 0);
}

export function sumExpenses(expenses) {
  return expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
}

export function sumOutstanding(invoices) {
  return invoices
    .filter((i) => ["sent", "viewed", "overdue"].includes(i.status))
    .reduce((sum, i) => sum + (i.balance_due || 0), 0);
}

export function buildExpenseCategoryData(expenses) {
  const byCategory = expenses.reduce((acc, e) => {
    const key = e.category || "other";
    acc[key] = (acc[key] || 0) + (e.amount || 0);
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
