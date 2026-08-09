/**
 * Resolve plain-language status + primary next action for Driver Hub.
 * Supports the three-question UI: happening / next / more.
 */

/**
 * @param {ReturnType<typeof import('./missionSnapshot.js').buildMissionSnapshot>|null} snap
 */
export function resolveDriverIntent(snap) {
  if (!snap) {
    return {
      happening: "Driver Hub isn’t ready yet.",
      nextLabel: "Refresh",
      nextFolder: "live-shift",
      nextHint: "Pull to refresh or try again.",
      moreLabel: "Explorer",
      moreHint: "History, analytics, and settings",
    };
  }

  const rush = snap.rushLabel && snap.rushLabel !== "—" ? snap.rushLabel : null;
  const platform =
    snap.platform && snap.platform !== "Idle" && snap.platform !== "Driving"
      ? snap.platform
      : null;

  if (snap.delivery && snap.ddLive) {
    const stage = snap.stage || "Active delivery";
    return {
      happening: `${stage}${platform ? ` · ${platform}` : ""}${rush ? ` · ${rush}` : ""}`,
      nextLabel: "Continue delivery",
      nextFolder: "doordash",
      nextHint: "Open DoorDash workflow",
      moreLabel: "Explorer",
      moreHint: "Orders, history, and analytics",
    };
  }

  if (snap.active && snap.paused) {
    return {
      happening: `Shift paused · ${snap.shiftTimeLabel}${rush ? ` · ${rush}` : ""}`,
      nextLabel: "Resume in Live Shift",
      nextFolder: "live-shift",
      nextHint: "Unpause and keep tracking",
      moreLabel: "Explorer",
      moreHint: "History, analytics, and settings",
    };
  }

  if (snap.active) {
    return {
      happening: `${snap.driverStatus} · ${snap.stage} · ${Number(snap.miles || 0).toFixed(1)} mi${
        rush ? ` · ${rush}` : ""
      }`,
      nextLabel: "Open shift controls",
      nextFolder: "live-shift",
      nextHint: "Stops, miles, and end shift",
      moreLabel: "Explorer",
      moreHint: "History, analytics, and settings",
    };
  }

  return {
    happening: `Off shift${rush ? ` · ${rush}` : ""}. Ready when you are.`,
    nextLabel: "Start your shift",
    nextFolder: "live-shift",
    nextHint: "Track miles and open live controls",
    moreLabel: "Explorer",
    moreHint: "History, analytics, and settings when you need them",
  };
}
