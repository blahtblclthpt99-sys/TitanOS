/**
 * Persist Driver Explorer open/closed folder state + last search.
 */
import { readLocal, writeLocal } from "@/lib/localStore";

const PREFIX = "titanos_driver_os";

const DEFAULT_OPEN = Object.freeze({
  "live-shift": true,
});

function normalizeOpen(open) {
  const selected = Object.entries(open || {}).filter(([, value]) => Boolean(value)).at(-1);
  return selected ? { [selected[0]]: true } : {};
}

export function readExplorerState(userId) {
  const raw = readLocal(PREFIX, userId, "explorer", null);
  if (!raw || typeof raw !== "object") {
    return { open: { ...DEFAULT_OPEN }, search: "", updatedAt: null };
  }
  return {
    open: normalizeOpen(raw.open),
    search: String(raw.search || ""),
    updatedAt: raw.updatedAt || null,
  };
}

export function writeExplorerState(userId, next) {
  const payload = {
    open: normalizeOpen(next.open),
    search: String(next.search || ""),
    updatedAt: new Date().toISOString(),
  };
  writeLocal(PREFIX, userId, "explorer", payload);
  return payload;
}

export function toggleFolderOpen(userId, folderId) {
  const state = readExplorerState(userId);
  const open = state.open[folderId] ? {} : { [folderId]: true };
  return writeExplorerState(userId, { ...state, open });
}

export function setExplorerSearch(userId, search) {
  const state = readExplorerState(userId);
  return writeExplorerState(userId, { ...state, search });
}
