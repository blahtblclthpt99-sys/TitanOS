export function createSecondMeActionId() {
  try {
    if (globalThis.crypto?.randomUUID) return `ai:${globalThis.crypto.randomUUID()}`;
  } catch {
    // fall through to entropy fallback
  }
  const random = Math.random().toString(36).slice(2, 12);
  return `ai:${Date.now().toString(36)}:${random}`;
}

export function ensureSecondMeActionId(meta = {}) {
  const current = String(meta?.actionId || "").trim();
  return current || createSecondMeActionId();
}
