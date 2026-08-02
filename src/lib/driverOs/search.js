/**
 * Folder summary chips + global delivery search index for Driver OS 4.0.
 */
import { readShiftHistory, readSession } from "@/lib/driverHubApi";
import { readDoorDashHistory, readActiveDelivery } from "@/lib/driverActivity/doorDashWorkflow.js";
import { collectTrips, summarizeTrips, filterTripsByPeriod } from "@/lib/driverActivity/intelligence.js";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function buildFolderSummaries(userId) {
  if (!userId) return {};
  const history = readShiftHistory(userId) || [];
  const session = readSession(userId);
  const ddHist = readDoorDashHistory(userId) || [];
  const dd = readActiveDelivery(userId);
  const day = todayKey();
  const todaysDd = ddHist.filter(
    (d) => String(d.dateLocal || "").startsWith(day) || String(d.startedAt || "").slice(0, 10) === day
  );
  const { sessions } = collectTrips(history);
  const week = summarizeTrips(filterTripsByPeriod(sessions, "week"));

  return {
    "live-shift": session?.active ? (session.paused ? "Paused" : "Driving ON") : "Off shift",
    "todays-orders": `${todaysDd.length} deliveries · ${history.filter((s) => String(s.started_at || "").slice(0, 10) === day).length} shifts`,
    "trip-history": `${history.length + ddHist.length} records`,
    analytics: week.trips ? `${week.trips} trips this week` : "Open for full stats",
    rush: "Breakfast → Overnight",
    platforms: dd ? "Delivery live" : "Multi-platform ready",
    heatmaps: "ZIP density",
    vehicle: "Economics & MPG",
    expenses: "Fuel · parking · tolls",
    tax: "Mileage deductions",
    reports: "Excel / CSV export",
    settings: "GPS · prefs · privacy",
    ai: "Titan observations",
    performance: "Daily score",
    goals: "Earnings targets",
    maintenance: "Service reminders",
    directory: "Publish or hire",
    doordash: dd ? "Active delivery" : "Start a workflow",
  };
}

/**
 * Search indexed deliveries / shifts. Returns hits that can deep-link into explorer folders.
 */
export function searchDeliveries(userId, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!userId || !q) return [];
  const hits = [];
  const history = readShiftHistory(userId) || [];
  for (const s of history) {
    const hay = [
      s.city,
      s.zip,
      s.apps,
      s.notes,
      s.id,
      "shift",
      s.started_at,
    ]
      .flat()
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (hay.includes(q)) {
      hits.push({
        id: s.id,
        kind: "shift",
        folder: "trip-history",
        title: `Shift · ${Number(s.miles || 0).toFixed(1)} mi`,
        subtitle: s.started_at ? new Date(s.started_at).toLocaleString() : "",
      });
    }
  }
  for (const d of readDoorDashHistory(userId) || []) {
    const hay = [
      d.orderTypeLabel,
      d.status,
      d.dateLocal,
      d.notes,
      d.aiNotes,
      d.voiceNotes,
      d.zip,
      d.restaurant,
      d.customer,
      "doordash",
      d.id,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (hay.includes(q)) {
      hits.push({
        id: d.id,
        kind: "doordash",
        folder: "todays-orders",
        title: `Delivery · ${d.orderTypeLabel || "Order"}`,
        subtitle: d.dateLocal || d.startedAt || "",
      });
    }
  }
  return hits.slice(0, 40);
}
