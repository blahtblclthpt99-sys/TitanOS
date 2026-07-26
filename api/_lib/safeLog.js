/**
 * Production-safe structured logging — never log tokens, secrets, or full bodies.
 * Emits JSON lines so log drains / Vercel can parse them.
 */
const SECRET_KEY = /password|secret|token|authorization|api[_-]?key|service_role|cookie|credential|pepper/i;

export function redactValue(value) {
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.length > 24 && /^(eyJ|sk_|rk_|whsec_|sbp_|re_)/.test(value)) return "[redacted]";
    return value.length > 500 ? `${value.slice(0, 120)}…[truncated]` : value;
  }
  if (Array.isArray(value)) return value.map(redactValue);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEY.test(k) ? "[redacted]" : redactValue(v);
    }
    return out;
  }
  return value;
}

function emit(level, scope, message, extra) {
  const line = {
    level,
    scope: String(scope || "app"),
    msg: String(message || ""),
    ts: new Date().toISOString(),
    service: "titanos",
  };
  if (extra !== undefined) line.extra = redactValue(extra);
  const serialized = JSON.stringify(line);
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.info(serialized);
}

export function logInfo(scope, message, extra) {
  emit("info", scope, message, extra);
}

export function logWarn(scope, message, extra) {
  emit("warn", scope, message, extra);
}

export function logError(scope, error, extra = undefined) {
  const message = error?.message || String(error || "unknown");
  const payload =
    extra !== undefined
      ? { ...(typeof extra === "object" && extra ? extra : { detail: extra }), errName: error?.name }
      : { errName: error?.name };
  emit("error", scope, message, payload);
}
