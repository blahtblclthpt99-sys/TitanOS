/**
 * Mission Control live snapshot — only operational "what do I need now?" fields.
 */
import {
  computeShiftDashboard,
  formatDuration,
  readPrefs,
  readSession,
  readStops,
  estimateGasPriceUsd,
} from "@/lib/driverHubApi";
import { classifyRushWindow } from "@/lib/driverActivity/intelligence.js";
import { readActiveDelivery, liveSnapshot, DD_STAGE_META } from "@/lib/driverActivity/doorDashWorkflow.js";
import { composeSmartCoachTip } from "@/lib/driverActivity/driverCoach.js";
import { readDriverGoals } from "@/lib/driverActivity/goals.js";

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
  let goals = {};
  try {
    goals = readDriverGoals(userId) || {};
  } catch {
    goals = {};
  }
  const goalEarn = Number(goals?.daily_earnings || 0) || 0;
  const earnNow = Number(dash?.earnings?.gross || 0) || 0;
  const goalPct = goalEarn > 0 ? Math.min(100, Math.round((earnNow / goalEarn) * 100)) : null;

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
  const profit = Number(dash?.profit ?? 0) || 0;

  return {
    active: Boolean(session?.active),
    paused: Boolean(session?.paused),
    platform: String(platform || "Idle"),
    stage: String(stage || "Off shift"),
    stageMeta: ddLive?.stage || DD_STAGE_META?.[ddLive?.screen] || null,
    earnings: earnNow,
    earningsLabel: `$${earnNow.toFixed(2)}`,
    shiftTimeSec: dash?.elapsedSec || 0,
    shiftTimeLabel: formatDuration(dash?.elapsedSec || 0),
    tripTimerLabel: ddLive?.primaryHms || formatDuration(dash?.driveSec || 0),
    miles,
    speedMph: Number(session?.avg_speed_mph || 0) || 0,
    maxSpeedMph: Number(session?.max_speed_mph || 0) || 0,
    profit,
    profitLabel: `$${profit.toFixed(2)}`,
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
    goalPct,
    goalLabel: goalPct != null ? `${goalPct}% of $${goalEarn}` : "No daily goal set",
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
