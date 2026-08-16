import { readLocal, writeLocal } from "@/lib/localStore";

const PREFIX = "titanos_titan_ai_ops";
const MAX_LOGS = 120;

function readState(userId) {
  return readLocal(PREFIX, userId, "state", {
    killSwitch: false,
    routines: [
      { id: "morning_ops", label: "Morning Ops", enabled: true },
      { id: "cash_recovery", label: "Cash Recovery Sprint", enabled: true },
      { id: "closeout", label: "Daily Closeout", enabled: true },
    ],
    logs: [],
  });
}

function writeState(userId, next) {
  writeLocal(PREFIX, userId, "state", next);
}

export function getTitanOpsState(userId) {
  if (!userId) return { killSwitch: false, routines: [], logs: [] };
  return readState(userId);
}

export function setTitanKillSwitch(userId, enabled) {
  if (!userId) return;
  const state = readState(userId);
  writeState(userId, { ...state, killSwitch: Boolean(enabled) });
}

export function setTitanRoutineEnabled(userId, routineId, enabled) {
  if (!userId || !routineId) return;
  const state = readState(userId);
  const routines = state.routines.map((r) =>
    r.id === routineId ? { ...r, enabled: Boolean(enabled) } : r
  );
  writeState(userId, { ...state, routines });
}

export function appendTitanActionLog(userId, row = {}) {
  if (!userId) return;
  const state = readState(userId);
  const nextRow = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    status: row.status || "info",
    title: String(row.title || "Titan action").slice(0, 160),
    detail: String(row.detail || "").slice(0, 600),
    correlationId: row.correlationId ? String(row.correlationId).slice(0, 128) : null,
    rollback: row.rollback || null,
  };
  const logs = [nextRow, ...(Array.isArray(state.logs) ? state.logs : [])].slice(0, MAX_LOGS);
  writeState(userId, { ...state, logs });
  return nextRow;
}

export function clearTitanActionLogs(userId) {
  if (!userId) return;
  const state = readState(userId);
  writeState(userId, { ...state, logs: [] });
}
