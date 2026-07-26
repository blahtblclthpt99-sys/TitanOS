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
export * from "./intelligence.js";
export * from "./goals.js";
export * from "./vehicleLogbook.js";
export * from "./tripJournal.js";
export * from "./offerAnalyzer.js";
export * from "./zipBenchmarks.js";
export * from "./excelExport.js";
export * from "./autopilot.js";
export * from "./trueCostPerMile.js";
export * from "./voiceCommands.js";
export * from "./driverCoach.js";
export * from "./doorDashWorkflow.js";
export { createBrowserTracker } from "./tracker.js";
export { createDoorDashTracker } from "./doorDashTracker.js";

/** Feature modules reserved for expansion (no-ops / stubs). */
export const ACTIVITY_MODULES = {
  multiVehicle: false,
  expenseTracking: true,
  fuelLogs: true,
  tollTracking: false,
  parkingExpenses: true,
  receiptScanning: false,
  maintenanceReminders: true,
  routeOptimization: false,
  safetyAlerts: false,
  fleetSupport: false,
  timeBetweenStops: true,
  driverIntelligence: true,
  tripWorthMeter: true,
  rushWindows: true,
  aiCoach: true,
  vehicleLogbook: true,
  tripClassification: true,
  offerAnalyzer: true,
  zipBenchmarks: true,
  excelExport: true,
  offerAutopilot: true,
  voiceCommands: true,
  doorDashWorkflow: true,
};
