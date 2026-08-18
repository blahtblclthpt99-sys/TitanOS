export const ACCOUNT_TYPES = Object.freeze({
  BUSINESS: "business",
  JOB_SEEKER: "job_seeker",
});

export function normalizeAccountType(value) {
  return String(value || "").trim().toLowerCase() === ACCOUNT_TYPES.BUSINESS
    ? ACCOUNT_TYPES.BUSINESS
    : ACCOUNT_TYPES.JOB_SEEKER;
}

export function isBusinessAccount(user) {
  return normalizeAccountType(user?.account_type) === ACCOUNT_TYPES.BUSINESS;
}

export function isJobSeekerAccount(user) {
  return !isBusinessAccount(user);
}

export function accountHomePath(user) {
  return isBusinessAccount(user) ? "/" : "/hire/matches";
}

export function accountLabel(user) {
  return isBusinessAccount(user) ? "Business" : "Job Seeker";
}
