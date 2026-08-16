export function isActionError(data) {
  return data?.type === "error";
}

export function shouldRetainRollback(data) {
  return isActionError(data);
}

export function rollbackMessage(existingContent, data = {}) {
  const base = String(existingContent || "").trim();
  const message = String(data?.message || (isActionError(data) ? "Rollback failed." : "Rollback completed.")).trim();
  const label = isActionError(data) ? "Rollback failed" : "Rollback";
  return [base, `${label}: ${message}`].filter(Boolean).join("\n\n");
}

export function confirmedActionErrorMessage(error) {
  const status = Number(error?.status || 0);
  if (status === 401) return "Your session expired before the action could run. Sign in again, then retry.";
  if (status === 403) return "Titan blocked that action because your account does not have permission to perform it.";
  if (status === 429) return "Titan is receiving too many requests right now. The action was not run; retry in a moment.";
  if (status >= 400 && status < 500) return String(error?.message || "Titan rejected that action. Nothing was changed.");
  return "That action failed safely. Nothing was assumed or silently changed.";
}
