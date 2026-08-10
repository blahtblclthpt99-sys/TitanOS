/**
 * Mission Control live snapshot — only operational "what do I need now?" fields.
 * @returns {import("./interfaces.js").MissionSnapshot | null}
 */
import {
  computeShiftDashboard,
  formatDuration,
  readPrefs,
  readSession,
  readStops,
  estimateGasPriceUsd,
  readShiftHistory,
} from "@/lib/driverHubApi";
import { classifyRushWindow, detectRushIntensity } from "@/lib/driverActivity/intelligence.js";
import { readActiveDelivery, liveSnapshot, DD_STAGE_META, readDoorDashHistory } from "@/lib/driverActivity/doorDashWorkflow.js";
import { composeSmartCoachTip } from "@/lib/driverActivity/driverCoach.js";
import { resolveWorkflowPhase, phaseLabel } from "@/lib/driverOs/workflowEngine.js";

function batteryStatus() {
  if (typeof navigator === "undefined" || !navigator.getBattery) {
    return { level: null, charging: null, label: "Battery n/a" };
  }
  return null; // async filled by Mission Control
}

function netStatus() {
  if (typeof navigator === "undefined") return { online: true, label: "Online" };
  return {
    online: navigator.onLine !== false,
    label: navigator.onLine === false ? "Offline" : "Online",
  };
}

/**
 * @param {string} userId
 * @param {{ battery?: { level: number|null, charging: boolean|null } }} [extra]
 */
export function buildMissionSnapshot(userId, extra = {}) {
  if (!userId) return null;

  const prefs = readPrefs(userId) || {};
  const session = readSession(userId);
  const stops = readStops(userId) || [];
  let gasUsd = 3.5;
  try {
    gasUsd = estimateGasPriceUsd(prefs.zip || "");
  } catch {
    gasUsd = 3.5;
  }

  let dash = null;
  try {
    dash = session
      ? computeShiftDashboard(session, stops, {
          mpg: Number(prefs.mpg) || 22,
          gasPriceLocal: typeof gasUsd === "number" ? gasUsd : 3.5,
          currency: prefs.currency || "USD",
        })
      : null;
  } catch (err) {
    console.warn("[missionSnapshot] dashboard", err);
  }

  let dd = null;
  let ddLive = null;
  try {
    dd = readActiveDelivery(userId);
    ddLive = liveSnapshot(dd);
  } catch (err) {
    console.warn("[missionSnapshot] doordash", err);
  }

  const rush = classifyRushWindow(new Date());
  let intensity = { id: "quiet", label: "Quiet", recentTrips: 0, windowMin: 90 };
  try {
    const cutoff = Date.now() - 90 * 60 * 1000;
    const recent = [];
    for (const s of readShiftHistory(userId) || []) {
      const t = s.ended_at || s.started_at;
      if (t && new Date(t).getTime() >= cutoff) recent.push({ started_at: s.started_at || s.ended_at });
    }
    if (session?.active && session.started_at) {
      recent.push({ started_at: session.started_at });
    }
    for (const d of readDoorDashHistory(userId) || []) {
      const t = d.endedAt || d.startedAt;
      if (t && new Date(t).getTime() >= cutoff) recent.push({ started_at: d.startedAt || d.endedAt });
    }
    intensity = detectRushIntensity(recent, new Date());
  } catch {
    /* keep quiet */
  }

  const workflowPhase = resolveWorkflowPhase({ session, delivery: dd });
  const idleSec = Number(session?.idle_sec || 0) || 0;
  const driveSec = Number(session?.drive_sec || 0) || 0;
  const apps = Array.isArray(session?.apps) ? session.apps : prefs.connectedApps || [];
  const platform =
    dd?.orderTypeLabel ||
    (Array.isArray(apps) && apps.length ? apps.filter(Boolean).join(" · ") : null) ||
    (session?.active ? "Driving" : "Idle");

  const stage =
    ddLive?.stage?.label ||
    (session?.stop_phase === "at_stop"
      ? "At stop"
      : session?.active
        ? session.paused
          ? "Paused"
          : "En route"
        : "Off shift");

  let aiTip = "Stay safe — track miles while Driving is ON.";
  try {
    const tip = composeSmartCoachTip({
      userId,
      mode: prefs.mode || "driving",
      mpg: Number(prefs.mpg) || 22,
      gasUsd: typeof gasUsd === "number" ? gasUsd : 3.5,
      rush,
    });
    aiTip =
      (typeof tip === "string" ? tip : tip?.full || tip?.tip || tip?.detail || tip?.text) || aiTip;
  } catch {
    /* keep default tip */
  }

  const net = netStatus();
  const bat = extra.battery || batteryStatus();
  const miles = Number(dash?.miles ?? session?.miles ?? 0) || 0;

  return {
    active: Boolean(session?.active),
    paused: Boolean(session?.paused),
    platform: String(platform || "Idle"),
    stage: String(stage || "Off shift"),
    stageMeta: ddLive?.stage || DD_STAGE_META?.[ddLive?.screen] || null,
    shiftTimeSec: dash?.elapsedSec || 0,
    shiftTimeLabel: formatDuration(dash?.elapsedSec || 0),
    tripTimerLabel: ddLive?.primaryHms || formatDuration(dash?.driveSec || 0),
    miles,
    speedMph: Number(session?.avg_speed_mph || 0) || 0,
    maxSpeedMph: Number(session?.max_speed_mph || 0) || 0,
    gpsOk: dd ? dd.gpsAvailable !== false : Boolean(prefs.autoTrack !== false && session?.active),
    gpsLabel: (dd ? dd.gpsAvailable !== false : session?.active) ? "GPS live" : "GPS idle",
    battery: bat,
    batteryLabel:
      bat?.level != null
        ? `${Math.round(bat.level * 100)}%${bat.charging ? " · charging" : ""}`
        : "Battery n/a",
    net,
    netLabel: net.label,
    rushId: rush?.id,
    rushLabel: rush?.label || "—",
    rushIntensityId: intensity?.id,
    rushIntensityLabel: intensity?.label || "Quiet",
    rushIntensityTrips: intensity?.recentTrips ?? 0,
    workflowPhase,
    workflowPhaseLabel: phaseLabel(workflowPhase),
    idleSec,
    idleLabel: formatDuration(idleSec),
    driveSec,
    driveLabel: formatDuration(driveSec),
    aiTip: String(aiTip).slice(0, 220),
    driverStatus: !session?.active
      ? "Off shift"
      : session.paused
        ? "Paused"
        : session.stop_phase === "at_stop"
          ? "Stopped"
          : "Driving",
    delivery: dd,
    ddLive,
    session,
    dash,
    prefs,
    stops,
  };
}
