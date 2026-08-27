const WORD_RE = /[a-z0-9+#.-]{2,}/gi;

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function list(value) {
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
}

function tokens(value) {
  return new Set((String(value || "").toLowerCase().match(WORD_RE) || []).filter((word) => word.length >= 3));
}

export function evidenceTerms(profile = {}) {
  const history = list(profile.work_history).flatMap((item) => [item?.role, item?.company, item?.summary]);
  return tokens([
    profile.headline,
    profile.bio,
    ...list(profile.skills),
    ...history,
    ...list(profile.achievements).map((item) => `${item?.title || ""} ${item?.description || ""}`),
  ].join(" "));
}

export function matchingEvidence(profile = {}, jobDescription = "") {
  const evidence = evidenceTerms(profile);
  const job = [...tokens(jobDescription)];
  return job.filter((term) => evidence.has(term)).slice(0, 30);
}

export function buildMasterResume(profile = {}) {
  const name = clean(profile.display_name) || "Professional";
  const location = [clean(profile.city), clean(profile.state)].filter(Boolean).join(", ");
  const skills = list(profile.skills);
  const history = Array.isArray(profile.work_history) ? profile.work_history : [];
  const achievements = Array.isArray(profile.achievements) ? profile.achievements : [];

  const lines = [name];
  if (clean(profile.headline)) lines.push(clean(profile.headline));
  if (location) lines.push(location);
  if (clean(profile.bio)) lines.push("", "PROFESSIONAL SUMMARY", clean(profile.bio));
  if (skills.length) lines.push("", "SKILLS", skills.join(" • "));
  if (history.length) {
    lines.push("", "WORK HISTORY");
    history.forEach((item) => {
      const role = clean(item?.role);
      const company = clean(item?.company);
      const dates = [clean(item?.start), clean(item?.end)].filter(Boolean).join(" – ");
      lines.push([role, company].filter(Boolean).join(" | "));
      if (dates) lines.push(dates);
      if (clean(item?.summary)) lines.push(clean(item.summary));
    });
  }
  if (achievements.length) {
    lines.push("", "ACHIEVEMENTS");
    achievements.forEach((item) => {
      const title = clean(item?.title);
      const description = clean(item?.description);
      if (title || description) lines.push(`• ${[title, description].filter(Boolean).join(": ")}`);
    });
  }
  return lines.join("\n").trim();
}

export function buildTailoredResume(profile = {}, jobDescription = "") {
  const master = buildMasterResume(profile);
  const matches = matchingEvidence(profile, jobDescription);
  if (!matches.length) return master;
  return `${master}\n\nJOB-ALIGNED EVIDENCE\n${matches.join(" • ")}`;
}

export function buildCoverLetter(profile = {}, jobDescription = "", options = {}) {
  const name = clean(profile.display_name) || "Applicant";
  const role = clean(options.role) || "the role";
  const company = clean(options.company) || "your organization";
  const matched = matchingEvidence(profile, jobDescription).slice(0, 8);
  const evidence = matched.length
    ? `My background includes experience and skills aligned with this opportunity, including ${matched.join(", ")}.`
    : "My background and work history are outlined in the attached resume, and I would welcome the opportunity to discuss how they align with this role.";
  return `Dear Hiring Team,\n\nI am applying for ${role} with ${company}. ${evidence}\n\nI am interested in learning more about the position and discussing the experience I can truthfully bring to the work. Thank you for your consideration.\n\nSincerely,\n${name}`;
}

export function buildInterviewBrief(profile = {}, jobDescription = "", options = {}) {
  const matched = matchingEvidence(profile, jobDescription).slice(0, 12);
  const skills = list(profile.skills).slice(0, 12);
  const history = Array.isArray(profile.work_history) ? profile.work_history : [];
  const lines = [
    `INTERVIEW BRIEF${clean(options.role) ? ` — ${clean(options.role)}` : ""}`,
    "",
    "Use only facts from your real profile and work history.",
  ];
  if (matched.length) lines.push("", "Strongest job-aligned evidence", ...matched.map((item) => `• ${item}`));
  if (skills.length) lines.push("", "Skills to be ready to discuss", ...skills.map((item) => `• ${item}`));
  if (history.length) lines.push("", "Work examples", ...history.slice(0, 5).map((item) => `• ${[clean(item?.role), clean(item?.company)].filter(Boolean).join(" at ")}${clean(item?.summary) ? ` — ${clean(item.summary)}` : ""}`));
  lines.push("", "Questions to ask", "• What does success look like in the first 90 days?", "• What are the most important day-to-day responsibilities?", "• What are the next steps in the hiring process?");
  return lines.join("\n");
}

export function buildApplicationPackage(profile = {}, jobDescription = "", options = {}) {
  return {
    masterResume: buildMasterResume(profile),
    tailoredResume: buildTailoredResume(profile, jobDescription),
    coverLetter: buildCoverLetter(profile, jobDescription, options),
    interviewBrief: buildInterviewBrief(profile, jobDescription, options),
    matchedEvidence: matchingEvidence(profile, jobDescription),
    generatedAt: new Date().toISOString(),
    policy: "Truthful tailoring only. Missing experience, credentials, dates, and accomplishments are never invented.",
  };
}
