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

/**
 * Delete without lying about authoritative state.
 *
 * Local-first records can still be removed while the backend is unavailable,
 * but a backend-backed record must not be reported as deleted when the remote
 * delete fails. A successful remote delete also clears any matching local
 * fallback copy without allowing cache-cleanup failure to overwrite remote
 * truth.
 */
export async function deleteEntityWithLocalFallback({
  id,
  remoteDelete,
  readLocalRows,
  writeLocalRows,
}) {
  const rows = readLocalRows();
  const localRows = Array.isArray(rows) ? rows : [];
  const hasLocalRecord = localRows.some((row) => row?.id === id);
  const withoutRecord = localRows.filter((row) => row?.id !== id);

  try {
    await remoteDelete();
    if (hasLocalRecord) {
      try {
        writeLocalRows(withoutRecord);
      } catch {
        // Remote state is authoritative; stale fallback cache must not turn a
        // successful server delete into a false UI failure.
      }
    }
    return { source: "remote", degraded: false };
  } catch (error) {
    if (!hasLocalRecord) throw error;
    writeLocalRows(withoutRecord);
    return { source: "local", degraded: true };
  }
}

/**
 * Update with the same authoritative-state rule as deletes.
 *
 * A remote-backed record must surface remote update failures. Only a record
 * already known to the local fallback store may be updated locally while the
 * backend is unavailable.
 */
export async function updateEntityWithLocalFallback({
  id,
  values,
  remoteUpdate,
  readLocalRows,
  writeLocalRows,
}) {
  const rows = readLocalRows();
  const localRows = Array.isArray(rows) ? rows : [];
  const localRecord = localRows.find((row) => row?.id === id);

  try {
    const updated = await remoteUpdate();
    if (localRecord) {
      const cached = { ...localRecord, ...values, ...(updated || {}) };
      try {
        writeLocalRows(localRows.map((row) => row?.id === id ? cached : row));
      } catch {
        // Remote state is authoritative; fallback-cache refresh is best effort.
      }
    }
    return updated;
  } catch (error) {
    if (!localRecord) throw error;
    const updated = { ...localRecord, ...values };
    writeLocalRows(localRows.map((row) => row?.id === id ? updated : row));
    return updated;
  }
}
