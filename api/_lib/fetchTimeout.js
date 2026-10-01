const DEFAULT_TIMEOUT_MS = 15_000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 60_000;

function normalizeTimeoutMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.trunc(parsed)));
}

/**
 * Fetch with a hard application-level deadline while preserving any caller
 * cancellation signal. Intended for server-side calls to external providers.
 */
export async function fetchWithTimeout(input, init = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const upstreamSignal = init?.signal;
  const onUpstreamAbort = () => controller.abort(upstreamSignal?.reason);

  if (upstreamSignal?.aborted) {
    controller.abort(upstreamSignal.reason);
  } else if (upstreamSignal?.addEventListener) {
    upstreamSignal.addEventListener("abort", onUpstreamAbort, { once: true });
  }

  const timer = setTimeout(() => controller.abort(), normalizeTimeoutMs(timeoutMs));
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    upstreamSignal?.removeEventListener?.("abort", onUpstreamAbort);
  }
}

export function isAbortError(error) {
  return Boolean(
    error &&
      (error.name === "AbortError" ||
        error.code === "ABORT_ERR" ||
        /aborted|abort|timeout/i.test(String(error.message || "")))
  );
}
