/**
 * Production-safe logging helpers — never log tokens, secrets, or full request bodies.
 */
const SECRET_KEY = /password|secret|token|authorization|api[_-]?key|service_role|cookie|credential/i;

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

export function logError(scope, error, extra = undefined) {
  const message = error?.message || String(error || "unknown");
  if (extra !== undefined) {
    console.error(`[${scope}]`, message, redactValue(extra));
  } else {
    console.error(`[${scope}]`, message);
  }
}
