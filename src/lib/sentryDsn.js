/** Return a trimmed, structurally valid Sentry DSN or an empty string. */
export function normalizeSentryDsn(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";

  try {
    const url = new URL(raw);
    const projectId = url.pathname.split("/").filter(Boolean).at(-1);
    if (!/^https?:$/.test(url.protocol) || !url.hostname || !url.username || !projectId) {
      return "";
    }
    return raw;
  } catch {
    return "";
  }
}
