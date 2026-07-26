import { readLocal, writeLocal } from "@/lib/localStore";

const PREFIX = "titanos_driver";
const KEY = "intel_goals";

export const DEFAULT_DRIVER_GOALS = Object.freeze({
  daily_earnings: 150,
  weekly_earnings: 800,
  monthly_earnings: 3000,
  daily_trips: 12,
  daily_miles_cap: 200,
  daily_hours_cap: 10,
});

export function readDriverGoals(userId) {
  const raw = readLocal(PREFIX, userId, KEY, null);
  return { ...DEFAULT_DRIVER_GOALS, ...(raw && typeof raw === "object" ? raw : {}) };
}

export function saveDriverGoals(userId, goals) {
  const next = { ...DEFAULT_DRIVER_GOALS, ...goals };
  writeLocal(PREFIX, userId, KEY, next);
  return next;
}
