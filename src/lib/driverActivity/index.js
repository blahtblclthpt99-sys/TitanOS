/**
 * Driver Activity Engine — public facade.
 * Modular surface for session telemetry, stops, stats, and tax export.
 * Future: vehicles, fuel logs, tolls, fleet — add adapters here without Hub rewrites.
 */

export * from "./geo.js";
export * from "./stopDetection.js";
export * from "./stats.js";
export * from "./export.js";
export * from "./betweenStops.js";
export { createBrowserTracker } from "./tracker.js";

/** Feature modules reserved for expansion (no-ops / stubs). */
export const ACTIVITY_MODULES = {
  multiVehicle: false,
  expenseTracking: false,
  fuelLogs: false,
  tollTracking: false,
  parkingExpenses: false,
  receiptScanning: false,
  maintenanceReminders: false,
  routeOptimization: false,
  safetyAlerts: false,
  fleetSupport: false,
  timeBetweenStops: true,
};
