/** Compute Titan Score (0–100) from live business health signals. */
export function computeTitanScore({
  invoices = [],
  jobs = [],
  customers = [],
  reviews = [],
  estimates = [],
} = {}) {
  const paid = invoices.filter((i) => i.status === "paid");
  const overdue = invoices.filter((i) => i.status === "overdue");
  const completed = jobs.filter((j) => j.status === "completed");
  const cancelled = jobs.filter((j) => j.status === "cancelled");
  const sentEst = estimates.filter((e) => ["sent", "viewed", "accepted"].includes(e.status));
  const acceptedEst = estimates.filter((e) => e.status === "accepted");

  const revenue = paid.reduce((s, i) => s + Number(i.total || 0), 0);
  const completionRate = jobs.length ? completed.length / jobs.length : 0.5;
  const cancelRate = jobs.length ? cancelled.length / jobs.length : 0;
  const payHealth = invoices.length ? paid.length / invoices.length : 0.5;
  const overdueRatio = invoices.length ? overdue.length / invoices.length : 0;
  const convertRate = sentEst.length ? acceptedEst.length / sentEst.length : 0.4;
  const reviewAvg =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + Number(r.rating || r.stars || 0), 0) / reviews.length
      : 4;
  const repeatCustomers = customers.filter((c) => Number(c.job_count || 0) > 1).length;
  const loyaltySignal = customers.length ? Math.min(1, repeatCustomers / Math.max(1, customers.length)) : 0;

  const revenuePts = Math.min(25, Math.log10(Math.max(revenue, 1) + 1) * 8);
  const completionPts = completionRate * 20;
  const paymentPts = payHealth * 20 - overdueRatio * 15;
  const reviewPts = (reviewAvg / 5) * 15;
  const convertPts = convertRate * 10;
  const loyaltyPts = loyaltySignal * 10;
  const cancelPenalty = cancelRate * 10;

  let score = Math.round(
    Math.max(0, Math.min(100, revenuePts + completionPts + paymentPts + reviewPts + convertPts + loyaltyPts - cancelPenalty))
  );

  let grade = "C";
  if (score >= 90) grade = "A+";
  else if (score >= 80) grade = "A";
  else if (score >= 70) grade = "B";
  else if (score >= 55) grade = "C";
  else grade = "D";

  const tips = [];
  if (overdue.length) tips.push(`Clear ${overdue.length} overdue invoice${overdue.length === 1 ? "" : "s"} to lift payment health.`);
  if (completionRate < 0.7 && jobs.length) tips.push("Finish open jobs — completion rate boosts your Titan Score.");
  if (reviewAvg < 4.2) tips.push("Ask happy customers for reviews after every completed job.");
  if (convertRate < 0.35 && sentEst.length) tips.push("Follow up on pending estimates to improve win rate.");
  if (!tips.length) tips.push("Strong fundamentals — keep logging jobs, payments, and reviews.");

  return {
    score,
    grade,
    revenue,
    breakdown: {
      revenue: Math.round(revenuePts),
      completion: Math.round(completionPts),
      payments: Math.round(Math.max(0, paymentPts)),
      reviews: Math.round(reviewPts),
      estimates: Math.round(convertPts),
      loyalty: Math.round(loyaltyPts),
    },
    stats: {
      paidCount: paid.length,
      overdueCount: overdue.length,
      completedJobs: completed.length,
      customers: customers.length,
      reviewAvg: Number(reviewAvg.toFixed(1)),
    },
    tips,
  };
}
