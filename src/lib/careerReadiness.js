const STOP_WORDS = new Set(["the","and","for","with","that","this","from","you","your","our","are","will","have","has","job","role","work","team","into","who","what","when","where","how","but","not","all","any","can","may","must","required","preferred"]);

export function normalizeSkill(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9+#./ -]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeSkills(values = []) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map(normalizeSkill)
    .filter((value) => value && !seen.has(value) && seen.add(value));
}

function textTokens(text) {
  const tokens = String(text || "").toLowerCase().match(/[a-z0-9+#./-]{3,}/g) || [];
  return [...new Set(tokens.filter((token) => !STOP_WORDS.has(token)))];
}

export function extractJobSignals(description = "") {
  const text = String(description || "");
  const tokens = textTokens(text);
  const credentialPatterns = [
    /\bcdl(?:\s+class\s+[ab])?\b/gi,
    /\bdot medical card\b/gi,
    /\bforklift(?: certification| certified)?\b/gi,
    /\bcpr(?: certification| certified)?\b/gi,
    /\bfirst aid(?: certification| certified)?\b/gi,
  ];
  const credentials = [];
  for (const pattern of credentialPatterns) {
    for (const match of text.matchAll(pattern)) credentials.push(normalizeSkill(match[0]));
  }
  return { tokens, credentials: [...new Set(credentials)] };
}

export function profileCompleteness(profile = {}) {
  const checks = [
    ["Headline", Boolean(String(profile.headline || "").trim())],
    ["Professional summary", String(profile.bio || "").trim().length >= 40],
    ["Skills", normalizeSkills(profile.skills).length >= 3],
    ["Work history", Array.isArray(profile.work_history) && profile.work_history.some((item) => String(item?.role || "").trim() && String(item?.company || "").trim())],
    ["Location", Boolean(String(profile.city || "").trim() && String(profile.state || "").trim())],
  ];
  const complete = checks.filter(([, ok]) => ok).length;
  return {
    score: Math.round((complete / checks.length) * 100),
    checks: checks.map(([label, ok]) => ({ label, complete: ok })),
  };
}

export function assessCareerReadiness(profile = {}, jobDescription = "") {
  const completeness = profileCompleteness(profile);
  const skills = normalizeSkills(profile.skills);
  const workText = (profile.work_history || []).map((item) => `${item?.role || ""} ${item?.company || ""} ${item?.summary || ""}`).join(" ").toLowerCase();
  const profileText = `${profile.headline || ""} ${profile.bio || ""} ${skills.join(" ")} ${workText}`.toLowerCase();
  const signals = extractJobSignals(jobDescription);

  const matchedTerms = signals.tokens.filter((term) => profileText.includes(term)).slice(0, 20);
  const missingTerms = signals.tokens.filter((term) => !profileText.includes(term)).slice(0, 12);
  const matchedCredentials = signals.credentials.filter((credential) => profileText.includes(credential));
  const missingCredentials = signals.credentials.filter((credential) => !profileText.includes(credential));

  const coverage = signals.tokens.length ? Math.min(100, Math.round((matchedTerms.length / Math.min(signals.tokens.length, 20)) * 100)) : 0;
  const credentialScore = signals.credentials.length ? Math.round((matchedCredentials.length / signals.credentials.length) * 100) : 100;
  const score = jobDescription.trim()
    ? Math.round(completeness.score * 0.35 + coverage * 0.45 + credentialScore * 0.20)
    : completeness.score;

  return {
    score: Math.max(0, Math.min(100, score)),
    completeness,
    matchedTerms,
    missingTerms,
    matchedCredentials,
    missingCredentials,
    disclaimer: "Readiness is a private coaching signal for the job seeker. It is not an employer decision, eligibility determination, or guarantee of employment.",
  };
}

export function buildInterviewPrepPrompt(profile = {}, jobDescription = "", assessment = null) {
  const result = assessment || assessCareerReadiness(profile, jobDescription);
  const history = (profile.work_history || []).slice(0, 5).map((item) => `${item.role || "Role"} at ${item.company || "Company"}: ${item.summary || ""}`).join("\n");
  return [
    "Act as my career interview coach. Use only the information below; do not invent experience, credentials, achievements, or employment history.",
    "",
    `Target job description:\n${String(jobDescription || "").trim()}`,
    "",
    `My headline: ${profile.headline || "Not provided"}`,
    `My skills: ${normalizeSkills(profile.skills).join(", ") || "Not provided"}`,
    `My work history:\n${history || "Not provided"}`,
    `Potential gaps to prepare for: ${result.missingTerms.join(", ") || "None identified from the supplied text"}`,
    `Credentials mentioned in the job that are not present in my profile: ${result.missingCredentials.join(", ") || "None identified"}`,
    "",
    "Give me: (1) the 8 most likely interview questions, (2) truthful answer frameworks grounded in my supplied experience, (3) 5 questions I should ask the employer, and (4) any gaps I should be ready to address honestly.",
  ].join("\n");
}
