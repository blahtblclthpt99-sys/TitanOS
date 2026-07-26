/**
 * Persist Driver Explorer open/closed folder state + last search.
 */
import { readLocal, writeLocal } from "@/lib/localStore";

const PREFIX = "titanos_driver_os";

const DEFAULT_OPEN = Object.freeze({
  "live-shift": true,
});

export function readExplorerState(userId) {
  const raw = readLocal(PREFIX, userId, "explorer", null);
  if (!raw || typeof raw !== "object") {
    return { open: { ...DEFAULT_OPEN }, search: "", updatedAt: null };
  }
  return {
    open: { ...DEFAULT_OPEN, ...(raw.open || {}) },
    search: String(raw.search || ""),
    updatedAt: raw.updatedAt || null,
  };
}

export function writeExplorerState(userId, next) {
  const payload = {
    open: next.open || {},
    search: String(next.search || ""),
    updatedAt: new Date().toISOString(),
  };
  writeLocal(PREFIX, userId, "explorer", payload);
  return payload;
}

export function toggleFolderOpen(userId, folderId) {
  const state = readExplorerState(userId);
  const open = { ...state.open, [folderId]: !state.open[folderId] };
  return writeExplorerState(userId, { ...state, open });
}

export function setExplorerSearch(userId, search) {
  const state = readExplorerState(userId);
  return writeExplorerState(userId, { ...state, search });
}
