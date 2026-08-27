function optionalIsoDate(value, label) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} is not a valid date and time.`);
  return date.toISOString();
}

export function normalizeCareerPipelineDetails(details = {}) {
  return {
    interview_at: optionalIsoDate(details.interviewAt, "Interview time"),
    follow_up_at: optionalIsoDate(details.followUpAt, "Follow-up time"),
    private_notes: String(details.notes || "").trim().slice(0, 5000) || null,
  };
}
