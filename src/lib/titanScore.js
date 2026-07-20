/**
 * Titan Score — trust & reliability score (0–100).
 * Factors: Reliability, Reviews, Response time, Completed work, Verification, Experience.
 */

export const TITAN_SCORE_FACTORS = [
  { id: "reliability", label: "Reliability", max: 20 },
  { id: "reviews", label: "Reviews", max: 20 },
  { id: "response", label: "Response time", max: 15 },
  { id: "completed", label: "Completed work", max: 20 },
  { id: "verification", label: "Verification", max: 15 },
  { id: "experience", label: "Experience", max: 10 },
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function gradeFromScore(score) {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  return "D";
}

/**
 * Business / user Titan Score from live ops + trust signals.
 */
export function computeTitanScore({
  invoices = [],
  jobs = [],
  customers = [],
  reviews = [],
  estimates = [],
  /** Avg response minutes (messages / booking). Lower is better. */
  responseTimeMin = null,
  /** 0–1 verification strength from Trust & Safety */
  verificationLevel = 0,
  /** Years active on platform or in trade */
  yearsExperience = null,
  /** Explicit reliability 0–1 override */
  reliabilityRate = null,
} = {}) {
  const paid = invoices.filter((i) => i.status === "paid");
  const overdue = invoices.filter((i) => i.status === "overdue");
  const completed = jobs.filter((j) => j.status === "completed");
  const cancelled = jobs.filter((j) => j.status === "cancelled");

  const revenue = paid.reduce((s, i) => s + Number(i.total || 0), 0);
  const completionRate = jobs.length ? completed.length / jobs.length : 0.55;
  const cancelRate = jobs.length ? cancelled.length / jobs.length : 0;
  const payHealth = invoices.length ? paid.length / invoices.length : 0.55;
  const overdueRatio = invoices.length ? overdue.length / invoices.length : 0;

  const reviewAvg =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + Number(r.rating || r.stars || 0), 0) / reviews.length
      : 0;
  const reviewCount = reviews.length;

  // Reliability — on-time completion + payment health − cancels/overdue
  const reliabilitySignal =
    reliabilityRate != null
      ? reliabilityRate
      : clamp(completionRate * 0.55 + payHealth * 0.35 - cancelRate * 0.5 - overdueRatio * 0.4, 0, 1);
  const reliabilityPts = reliabilitySignal * 20;

  // Reviews — avg rating weighted by volume
  const reviewVolumeBoost = reviewCount === 0 ? 0.45 : clamp(0.55 + Math.log10(reviewCount + 1) * 0.2, 0.55, 1);
  const reviewPts = reviewCount === 0 ? 8 : (reviewAvg / 5) * 20 * reviewVolumeBoost;

  // Response time — prefer explicit; else estimate from recent activity density
  let responsePts = 8;
  if (responseTimeMin != null && Number.isFinite(responseTimeMin)) {
    if (responseTimeMin <= 5) responsePts = 15;
    else if (responseTimeMin <= 15) responsePts = 12;
    else if (responseTimeMin <= 60) responsePts = 9;
    else if (responseTimeMin <= 240) responsePts = 5;
    else responsePts = 2;
  } else if (jobs.length + invoices.length > 20) {
    responsePts = 11;
  }

  // Completed work — volume + completion rate
  const volumePts = Math.min(12, Math.log10(Math.max(completed.length, 1) + 1) * 6);
  const completedPts = volumePts + completionRate * 8;

  // Verification — Trust & Safety level 0–1
  const verificationPts = clamp(Number(verificationLevel) || 0, 0, 1) * 15;

  // Experience — years or proxy from job history / customers
  let experiencePts = 4;
  if (yearsExperience != null && Number.isFinite(yearsExperience)) {
    experiencePts = clamp(yearsExperience, 0, 12) * (10 / 12);
  } else if (completed.length >= 50 || customers.length >= 30) {
    experiencePts = 9;
  } else if (completed.length >= 15 || customers.length >= 10) {
    experiencePts = 7;
  } else if (completed.length >= 5) {
    experiencePts = 5;
  }

  const score = Math.round(
    clamp(reliabilityPts + reviewPts + responsePts + completedPts + verificationPts + experiencePts, 0, 100)
  );

  const tips = [];
  if (verificationLevel < 0.5) tips.push("Complete Trust & Safety verification to earn the Titan Verified badge.");
  if (overdue.length) tips.push(`Clear ${overdue.length} overdue invoice${overdue.length === 1 ? "" : "s"} to boost reliability.`);
  if (completionRate < 0.7 && jobs.length) tips.push("Finish open jobs — completed work lifts your Titan Score.");
  if (reviewAvg < 4.2 || reviewCount < 3) tips.push("Ask happy customers for reviews after every completed job.");
  if (responseTimeMin != null && responseTimeMin > 30) tips.push("Reply to messages faster — response time is a scored factor.");
  if (!tips.length) tips.push("Strong trust signals — keep delivering on time and staying verified.");

  return {
    score,
    grade: gradeFromScore(score),
    revenue,
    factors: {
      reliability: Math.round(reliabilityPts),
      reviews: Math.round(reviewPts),
      response: Math.round(responsePts),
      completed: Math.round(completedPts),
      verification: Math.round(verificationPts),
      experience: Math.round(experiencePts),
    },
    /** @deprecated Prefer `factors` — kept for older UI */
    breakdown: {
      reliability: Math.round(reliabilityPts),
      reviews: Math.round(reviewPts),
      response: Math.round(responsePts),
      completed: Math.round(completedPts),
      verification: Math.round(verificationPts),
      experience: Math.round(experiencePts),
    },
    stats: {
      paidCount: paid.length,
      overdueCount: overdue.length,
      completedJobs: completed.length,
      customers: customers.length,
      reviewAvg: Number((reviewCount ? reviewAvg : 0).toFixed(1)),
      reviewCount,
      responseTimeMin,
      verificationLevel: Number(verificationLevel) || 0,
    },
    tips,
  };
}

/**
 * Titan Score for marketplace driver profiles.
 */
export function computeDriverTitanScore(driver = {}) {
  const rating = Number(driver.rating) || 0;
  const reviewCount = Number(driver.reviewCount) || driver.reviews?.length || 0;
  const responseMin = Number(driver.responseTimeMin);
  const completed = Number(driver.completedJobs) || 0;
  const years = Number(driver.yearsExperience) || 0;
  const available = driver.availability === "available";

  let verificationLevel = 0;
  if (driver.verified) verificationLevel += 0.4;
  if (driver.insured) verificationLevel += 0.3;
  if (driver.backgroundChecked) verificationLevel += 0.3;

  const reliabilityRate = available ? 0.92 : driver.availability === "busy" ? 0.78 : 0.55;

  return computeTitanScore({
    jobs: Array.from({ length: Math.min(completed, 80) }, (_, i) => ({
      status: i < completed * 0.9 ? "completed" : "cancelled",
    })),
    invoices: [],
    customers: [],
    reviews: Array.from({ length: Math.min(reviewCount, 40) }, () => ({ rating })),
    responseTimeMin: Number.isFinite(responseMin) ? responseMin : 15,
    verificationLevel,
    yearsExperience: years,
    reliabilityRate,
  });
}

/**
 * Whether the user qualifies for the Titan Verified badge.
 * Requires ID (or driver's license) verified + at least one other trust check, or verified_worker + KYC progress.
 */
export function isTitanVerified({
  verifiedWorker = false,
  trustState = null,
  driver = null,
} = {}) {
  if (driver) {
    return Boolean(driver.verified && (driver.insured || driver.backgroundChecked));
  }
  const idOk =
    trustState?.identity?.status === "verified" || trustState?.drivers_license?.status === "verified";
  const extraOk =
    trustState?.phone?.status === "verified" ||
    trustState?.email?.status === "verified" ||
    trustState?.insurance?.status === "verified" ||
    trustState?.background?.status === "verified";
  if (idOk && extraOk) return true;
  if (verifiedWorker && idOk) return true;
  // Demo / seed profiles that already mark verified
  if (verifiedWorker && trustState?.identity?.status !== "rejected") {
    const summaryVerified = [trustState?.email, trustState?.phone, trustState?.identity]
      .filter(Boolean)
      .filter((x) => x.status === "verified").length;
    if (summaryVerified >= 2) return true;
  }
  return false;
}

/** Verification level 0–1 from Trust & Safety state */
export function verificationLevelFromTrust(state) {
  if (!state) return 0;
  const keys = ["email", "phone", "identity", "drivers_license", "insurance", "background"];
  const verified = keys.filter((k) => state[k]?.status === "verified").length;
  const twoFa = state?.two_factor?.enabled ? 0.1 : 0;
  return clamp(verified / keys.length + twoFa, 0, 1);
}
