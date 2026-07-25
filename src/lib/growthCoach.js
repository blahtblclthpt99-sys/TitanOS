export function buildWeeklyCoachReport({ invoices = [], expenses = [], customers = [], jobs = [], estimates = [] }) {
  const paid = invoices.filter((row) => ["paid", "sent"].includes(row.status)).reduce((sum, row) => sum + Number(row.total || row.amount || 0), 0);
  const spend = expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const completed = jobs.filter((row) => row.status === "completed");
  const serviceCounts = completed.reduce((counts, row) => ({ ...counts, [row.service_type || row.title || "General service"]: (counts[row.service_type || row.title || "General service"] || 0) + 1 }), {});
  const topService = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0];
  const staleEstimates = estimates.filter((row) => !["accepted", "won", "rejected", "declined"].includes(row.status)).length;
  const insights = [];
  if (paid) {
    insights.push({
      text: `You collected $${paid.toLocaleString()} this period. Keep invoices moving by following up on unpaid balances.`,
      path: "/invoices",
    });
  }
  if (spend > paid && paid) {
    insights.push({
      text: `Expenses ($${spend.toLocaleString()}) exceeded collected revenue. Review material costs and price floor.`,
      path: "/finances",
    });
  }
  if (topService) {
    insights.push({
      text: `${topService[0]} is your top service (${topService[1]} completed jobs). Feature it in your next promotion.`,
      path: "/marketing",
    });
  }
  if (staleEstimates) {
    insights.push({
      text: `${staleEstimates} estimate${staleEstimates === 1 ? "" : "s"} need follow-up—these are your most recoverable lost leads.`,
      path: "/estimates",
    });
  }
  if (customers.length && completed.length / customers.length < 0.5) {
    insights.push({
      text: "Increase repeat work: queue maintenance follow-ups for completed jobs.",
      path: "/follow-ups",
    });
  }
  if (!insights.length) {
    insights.push({
      text: "Add jobs, invoices, and expenses to unlock a personalized weekly growth plan.",
      path: "/jobs?new=1",
    });
  }
  return insights;
}
