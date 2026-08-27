const WORD_RE = /[a-z0-9+#.-]{2,}/gi;
const STOP_WORDS = new Set([
  "and", "are", "for", "from", "has", "have", "into", "its", "job", "our", "that", "the", "their", "this", "with", "you", "your",
]);

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stringList(value) {
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
}

function objectList(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function tokens(value) {
  return new Set(
    (String(value || "").toLowerCase().match(WORD_RE) || [])
      .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
  );
}

function intersects(left, right) {
  for (const term of left) if (right.has(term)) return true;
  return false;
}

function workHistoryText(item) {
  return [item?.role, item?.company, item?.summary].map(clean).filter(Boolean).join(" ");
}

function achievementText(item) {
  return [item?.title, item?.description].map(clean).filter(Boolean).join(" ");
}

function alignedProfileEvidence(profile = {}, jobDescription = "") {
  const jobTerms = tokens(jobDescription);
  if (!jobTerms.size) return { skills: [], history: [], achievements: [] };

  return {
    skills: stringList(profile.skills).filter((skill) => intersects(tokens(skill), jobTerms)).slice(0, 12),
    history: objectList(profile.work_history).filter((item) => intersects(tokens(workHistoryText(item)), jobTerms)).slice(0, 6),
    achievements: objectList(profile.achievements).filter((item) => intersects(tokens(achievementText(item)), jobTerms)).slice(0, 6),
  };
}

export function evidenceTerms(profile = {}) {
  const history = objectList(profile.work_history).flatMap((item) => [item?.role, item?.company, item?.summary]);
  const achievements = objectList(profile.achievements).flatMap((item) => [item?.title, item?.description]);
  return tokens([
    profile.headline,
    profile.bio,
    ...stringList(profile.skills),
    ...history,
    ...achievements,
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
  const skills = stringList(profile.skills);
  const history = objectList(profile.work_history);
  const achievements = objectList(profile.achievements);

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
      const heading = [role, company].filter(Boolean).join(" | ");
      if (heading) lines.push(heading);
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
  const aligned = alignedProfileEvidence(profile, jobDescription);
  const highlights = [];

  aligned.skills.forEach((skill) => highlights.push(`• Skill: ${skill}`));
  aligned.history.forEach((item) => {
    const heading = [clean(item?.role), clean(item?.company)].filter(Boolean).join(" | ");
    const summary = clean(item?.summary);
    if (heading || summary) highlights.push(`• Experience: ${[heading, summary].filter(Boolean).join(" — ")}`);
  });
  aligned.achievements.forEach((item) => {
    const evidence = [clean(item?.title), clean(item?.description)].filter(Boolean).join(": ");
    if (evidence) highlights.push(`• Achievement: ${evidence}`);
  });

  if (!highlights.length) return master;
  return `${master}\n\nTARGETED HIGHLIGHTS\n${highlights.join("\n")}`;
}

export function buildCoverLetter(profile = {}, jobDescription = "", options = {}) {
  const name = clean(profile.display_name) || "Applicant";
  const role = clean(options.role) || "the role";
  const company = clean(options.company) || "your organization";
  const aligned = alignedProfileEvidence(profile, jobDescription);
  const labels = [
    ...aligned.skills,
    ...aligned.history.map((item) => [clean(item?.role), clean(item?.company)].filter(Boolean).join(" at ")),
    ...aligned.achievements.map((item) => clean(item?.title)),
  ].filter(Boolean).slice(0, 6);
  const evidence = labels.length
    ? `My profile includes relevant evidence such as ${labels.join(", ")}.`
    : "My background and work history are outlined in the attached resume, and I would welcome the opportunity to discuss how they align with this role.";
  return `Dear Hiring Team,\n\nI am applying for ${role} with ${company}. ${evidence}\n\nI am interested in learning more about the position and discussing the experience I can truthfully bring to the work. Thank you for your consideration.\n\nSincerely,\n${name}`;
}

export function buildInterviewBrief(profile = {}, jobDescription = "", options = {}) {
  const matched = matchingEvidence(profile, jobDescription).slice(0, 12);
  const skills = stringList(profile.skills).slice(0, 12);
  const history = objectList(profile.work_history);
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
