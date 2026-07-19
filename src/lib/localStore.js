/** Local-first fallback when Supabase tables are not yet migrated. */
export function storageKey(prefix, userId, suffix) {
  return `${prefix}_${suffix}_${userId || "anon"}`;
}

export function readLocal(prefix, userId, suffix, fallback = []) {
  try {
    const raw = localStorage.getItem(storageKey(prefix, userId, suffix));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(prefix, userId, suffix, value) {
  localStorage.setItem(storageKey(prefix, userId, suffix), JSON.stringify(value));
}

export function uid() {
  return crypto.randomUUID?.() || `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function withEntityFallback(entityName, remoteFn, localFn) {
  try {
    return await remoteFn();
  } catch {
    return localFn();
  }
}
