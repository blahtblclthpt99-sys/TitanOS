export function buildWeeklyCoachReport({ invoices = [], expenses = [], customers = [], jobs = [], estimates = [] }) {
  const paid = invoices.filter((row) => ["paid", "sent"].includes(row.status)).reduce((sum, row) => sum + Number(row.total || row.amount || 0), 0);
  const spend = expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const completed = jobs.filter((row) => row.status === "completed");
  const serviceCounts = completed.reduce((counts, row) => ({ ...counts, [row.service_type || row.title || "General service"]: (counts[row.service_type || row.title || "General service"] || 0) + 1 }), {});
  const topService = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0];
  const staleEstimates = estimates.filter((row) => !["accepted", "won", "rejected", "declined"].includes(row.status)).length;
  const insights = [];
  if (paid) insights.push(`You collected $${paid.toLocaleString()} this period. Keep invoices moving by following up on unpaid balances.`);
  if (spend > paid && paid) insights.push(`Expenses ($${spend.toLocaleString()}) exceeded collected revenue. Review material costs and price floor.`);
  if (topService) insights.push(`${topService[0]} is your top service (${topService[1]} completed jobs). Feature it in your next promotion.`);
  if (staleEstimates) insights.push(`${staleEstimates} estimate${staleEstimates === 1 ? "" : "s"} need follow-up—these are your most recoverable lost leads.`);
  if (customers.length && completed.length / customers.length < 0.5) insights.push("Increase repeat work: queue maintenance follow-ups for completed jobs.");
  if (!insights.length) insights.push("Add jobs, invoices, and expenses to unlock a personalized weekly growth plan.");
  return insights;
}
