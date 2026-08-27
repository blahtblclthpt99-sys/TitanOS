const RISK_PATTERNS = [
  { pattern: /\b(pay|send|wire|transfer)\b.{0,30}\b(fee|deposit|money|crypto|bitcoin|gift card)\b/i, label: "Requests payment or transfer from applicant", weight: 35 },
  { pattern: /\btelegram\b|\bwhatsapp\b/i, label: "Moves recruiting to an informal messaging channel", weight: 12 },
  { pattern: /\bno interview\b|\bhired immediately\b|\bguaranteed job\b/i, label: "Promises employment without a normal hiring process", weight: 22 },
  { pattern: /\bcheck\b.{0,35}\b(equipment|supplies|deposit)\b/i, label: "Mentions a check/equipment purchasing arrangement", weight: 30 },
  { pattern: /\bssn\b|social security number|bank account/i, label: "Requests highly sensitive information in the listing", weight: 25 },
];

function text(value) { return String(value || "").trim(); }
function lower(value) { return text(value).toLowerCase(); }

export function employerName(job = {}) {
  return text(job.company || job.company_name || job.employer || job.organization || job.source_name) || "Employer not provided";
}

export function employerKey(job = {}) {
  return [lower(employerName(job)), lower(job.city), lower(job.state)].join("|");
}

export function assessOpportunityRisk(job = {}) {
  const body = [job.title, job.description, job.summary, job.requirements].map(text).join(" \n");
  const signals = RISK_PATTERNS.filter((rule) => rule.pattern.test(body));
  const sourceUrl = text(job.source_url || job.match?.source_url);
  if (sourceUrl && !/^https:\/\//i.test(sourceUrl)) signals.push({ label: "Listing link is not HTTPS", weight: 25 });
  if (!employerName(job) || employerName(job) === "Employer not provided") signals.push({ label: "Employer identity is not provided", weight: 10 });
  if (!text(job.description)) signals.push({ label: "Listing has limited job detail", weight: 8 });

  const score = Math.min(100, signals.reduce((sum, item) => sum + item.weight, 0));
  const level = score >= 50 ? "high" : score >= 20 ? "review" : "low";
  return {
    score,
    level,
    signals: signals.map(({ label }) => label),
    guidance: level === "low"
      ? "No obvious scam pattern was detected. Verify the employer and offer independently before sharing sensitive data."
      : "Pause and verify the employer, application URL, recruiter identity, and compensation terms before proceeding.",
  };
}

export function buildEmployerSummary(jobs = []) {
  const groups = new Map();
  for (const job of jobs || []) {
    const key = employerKey(job);
    if (!groups.has(key)) groups.set(key, { key, name: employerName(job), city: text(job.city), state: text(job.state), jobs: [] });
    groups.get(key).jobs.push(job);
  }
  return [...groups.values()].map((group) => {
    const risks = group.jobs.map(assessOpportunityRisk);
    const sourceNames = [...new Set(group.jobs.map((job) => text(job.source_name || job.match?.source_name || (job.source === "external" ? "External provider" : "TitanOS"))).filter(Boolean))];
    return {
      ...group,
      openListings: group.jobs.length,
      sources: sourceNames,
      riskLevel: risks.some((r) => r.level === "high") ? "high" : risks.some((r) => r.level === "review") ? "review" : "low",
      riskSignals: [...new Set(risks.flatMap((r) => r.signals))],
    };
  }).sort((a, b) => b.openListings - a.openListings || a.name.localeCompare(b.name));
}

export function matchesAlert(job, alert = {}) {
  const query = lower(alert.query);
  const location = lower(alert.location);
  const minMatch = Number(alert.minMatch || 0);
  const haystack = lower([job.title, employerName(job), job.description].join(" "));
  const place = lower([job.city, job.state].filter(Boolean).join(" "));
  const matchScore = Number(job.match?.score || 0);
  if (query && !haystack.includes(query)) return false;
  if (location && !place.includes(location)) return false;
  if (minMatch && matchScore < minMatch) return false;
  if (alert.source === "titan" && (job.source === "external" || job.match?.source === "external")) return false;
  if (alert.source === "external" && !(job.source === "external" || job.match?.source === "external")) return false;
  return true;
}

export function evaluateAlerts(jobs = [], alerts = []) {
  return (alerts || []).map((alert) => ({ ...alert, matches: (jobs || []).filter((job) => matchesAlert(job, alert)) }));
}
