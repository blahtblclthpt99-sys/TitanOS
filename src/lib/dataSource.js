/**
 * Honesty helpers for remote vs device-local vs stubbed provider responses.
 * Money/trust/hire callers should check `_source` / `stub` before success toasts.
 */

export const DATA_SOURCE = Object.freeze({
  remote: "remote",
  local: "local",
  stub: "stub",
});

export class PersistenceError extends Error {
  constructor(message, { source = DATA_SOURCE.local, code = "PERSISTENCE", cause } = {}) {
    super(message);
    this.name = "PersistenceError";
    this.source = source;
    this.code = code;
    if (cause) this.cause = cause;
  }
}

/** Attach `_source` to an object or array (non-enumerable-ish via plain property). */
export function withSource(data, source) {
  if (data == null) return data;
  if (Array.isArray(data)) {
    Object.defineProperty(data, "_source", { value: source, writable: true, configurable: true, enumerable: false });
    return data;
  }
  return { ...data, _source: source };
}

export function getSource(value) {
  return value?._source || null;
}

export function isLocalOrStub(value) {
  const s = getSource(value);
  return s === DATA_SOURCE.local || s === DATA_SOURCE.stub || Boolean(value?.stub);
}

export function isStub(value) {
  return Boolean(value?.stub) || getSource(value) === DATA_SOURCE.stub;
}
