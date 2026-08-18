export const WORKSPACES = Object.freeze({
  JOB_SEEKER: "job_seeker",
  SELF_EMPLOYED: "self_employed",
  BUSINESS: "business",
});

export const WORKSPACE_LABELS = Object.freeze({
  [WORKSPACES.JOB_SEEKER]: "Job Seeker",
  [WORKSPACES.SELF_EMPLOYED]: "Independent Work",
  [WORKSPACES.BUSINESS]: "Business",
});

const ALLOWED = new Set(Object.values(WORKSPACES));

export function normalizeWorkspace(value) {
  const clean = String(value || "").trim().toLowerCase();
  return ALLOWED.has(clean) ? clean : WORKSPACES.JOB_SEEKER;
}

export function enabledWorkspaces(user) {
  const explicit = Array.isArray(user?.enabled_workspaces)
    ? user.enabled_workspaces.map(normalizeWorkspace)
    : [];
  const unique = [...new Set(explicit.filter((value) => ALLOWED.has(value)))];
  if (unique.length) return unique;

  // Compatibility for profiles created before the workspace migration.
  if (String(user?.account_type || "").toLowerCase() === WORKSPACES.BUSINESS) {
    return [WORKSPACES.BUSINESS];
  }
  return [WORKSPACES.JOB_SEEKER];
}

export function activeWorkspace(user) {
  const enabled = enabledWorkspaces(user);
  const requested = normalizeWorkspace(user?.active_workspace || user?.account_type);
  return enabled.includes(requested) ? requested : enabled[0];
}

export function hasWorkspace(user, workspace) {
  return enabledWorkspaces(user).includes(normalizeWorkspace(workspace));
}

export function isBusinessAccount(user) {
  return activeWorkspace(user) === WORKSPACES.BUSINESS;
}

export function isJobSeekerAccount(user) {
  return activeWorkspace(user) === WORKSPACES.JOB_SEEKER;
}

export function isSelfEmployedAccount(user) {
  return activeWorkspace(user) === WORKSPACES.SELF_EMPLOYED;
}

export function accountHomePath(user) {
  const workspace = activeWorkspace(user);
  if (workspace === WORKSPACES.BUSINESS) return "/";
  if (workspace === WORKSPACES.SELF_EMPLOYED) return "/independent";
  return "/hire/matches";
}

export function accountLabel(user) {
  return WORKSPACE_LABELS[activeWorkspace(user)] || "Job Seeker";
}

// Compatibility exports while older components are migrated.
export const ACCOUNT_TYPES = Object.freeze({
  BUSINESS: WORKSPACES.BUSINESS,
  JOB_SEEKER: WORKSPACES.JOB_SEEKER,
  SELF_EMPLOYED: WORKSPACES.SELF_EMPLOYED,
});

export const normalizeAccountType = normalizeWorkspace;
