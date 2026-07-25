/**
 * Time Between Stops — pure analytics for work sessions.
 * Uses active drive_sec and miles deltas (not only wall-clock).
 */

import { round1 } from "./geo.js";

function ts(iso) {
  const t = new Date(iso || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function secBetween(aIso, bIso) {
  return Math.max(0, Math.round((ts(bIso) - ts(aIso)) / 1000));
}

/** Coerce localStorage / history payloads to a real array (objects throw on spread). */
function asStopList(stops) {
  if (Array.isArray(stops)) return stops;
  if (stops && typeof stops === "object") return Object.values(stops).filter(Boolean);
  return [];
}

/** Oldest → newest */
export function chronologicalStops(stops = []) {
  return [...asStopList(stops)].sort((a, b) => ts(a.started_at) - ts(b.started_at));
}

/**
 * Enrich stops with between-stop drive/distance and running totals.
 */
export function buildStopLegReport(session, stops = [], opts = {}) {
  const nowIso = opts.now ? new Date(opts.now).toISOString() : new Date().toISOString();
  const sessionStart = session?.started_at || nowIso;
  const sessionEnd = session?.ended_at || (session?.active ? nowIso : nowIso);
  const ordered = chronologicalStops(stops);

  const sessionMiles = Number(session?.miles || 0);
  const sessionDrive = Number(session?.drive_sec || 0);
  const sessionIdle = Number(session?.idle_sec || 0);

  let prevDepartureIso = sessionStart;
  let prevDepartureMiles = 0;
  let prevDepartureDrive = 0;

  const enriched = ordered.map((raw, index) => {
    const arrivalIso = raw.started_at || nowIso;
    const departed = Boolean(raw.ended_at);
    const departureIso = raw.ended_at || null;

    const milesAtArrival =
      raw.miles_at_arrival != null
        ? Number(raw.miles_at_arrival)
        : Math.max(prevDepartureMiles, Number(raw.miles_delta || 0) + prevDepartureMiles);
    const driveAtArrival =
      raw.drive_sec_at_arrival != null ? Number(raw.drive_sec_at_arrival) : prevDepartureDrive;

    const driveSincePrev =
      raw.drive_since_prev_sec != null
        ? Number(raw.drive_since_prev_sec)
        : Math.max(0, driveAtArrival - prevDepartureDrive);

    const milesSincePrev =
      raw.miles_since_prev != null
        ? Number(raw.miles_since_prev)
        : Math.max(0, round1(milesAtArrival - prevDepartureMiles));

    const wallSincePrev =
      raw.between_orders_sec != null
        ? Number(raw.between_orders_sec)
        : secBetween(prevDepartureIso, arrivalIso);

    const durationSec = departed
      ? Number(raw.duration_sec) || secBetween(arrivalIso, departureIso)
      : secBetween(arrivalIso, nowIso);

    const milesAtDeparture = departed
      ? raw.miles_at_departure != null
        ? Number(raw.miles_at_departure)
        : milesAtArrival
      : milesAtArrival;
    const driveAtDeparture = departed
      ? raw.drive_sec_at_departure != null
        ? Number(raw.drive_sec_at_departure)
        : driveAtArrival
      : driveAtArrival;

    const card = {
      id: raw.id,
      stopNumber: index + 1,
      label: raw.label || raw.note || `Stop ${index + 1}`,
      auto: Boolean(raw.auto),
      arrived_at: arrivalIso,
      departed_at: departureIso,
      open: !departed,
      duration_sec: durationSec,
      drive_since_prev_sec: driveSincePrev,
      miles_since_prev: milesSincePrev,
      wall_since_prev_sec: wallSincePrev,
      miles_at_arrival: round1(milesAtArrival),
      miles_at_departure: round1(milesAtDeparture),
      drive_sec_at_arrival: driveAtArrival,
      drive_sec_at_departure: driveAtDeparture,
      running_miles: round1(milesAtArrival),
      running_drive_sec: driveAtArrival,
      lat: raw.lat ?? null,
      lng: raw.lng ?? null,
      sinceLabel: index === 0 ? "Since session start" : `Since Stop ${index}`,
    };

    if (departed) {
      prevDepartureIso = departureIso;
      prevDepartureMiles = milesAtDeparture;
      prevDepartureDrive = driveAtDeparture;
    } else {
      prevDepartureIso = arrivalIso;
      prevDepartureMiles = milesAtArrival;
      prevDepartureDrive = driveAtArrival;
    }

    return card;
  });

  const last = enriched[enriched.length - 1];
  const lastDeparted = last && !last.open ? last : null;
  const afterLastDriveSec = lastDeparted
    ? Math.max(0, sessionDrive - Number(lastDeparted.drive_sec_at_departure || 0))
    : enriched.length === 0
      ? sessionDrive
      : Math.max(0, sessionDrive - Number(last?.drive_sec_at_arrival || 0));
  const afterLastMiles = lastDeparted
    ? Math.max(0, round1(sessionMiles - Number(lastDeparted.miles_at_departure || 0)))
    : enriched.length === 0
      ? sessionMiles
      : Math.max(0, round1(sessionMiles - Number(last?.miles_at_arrival || 0)));

  const driveLegs = [];
  for (const card of enriched) {
    driveLegs.push({
      type: "drive",
      from: card.stopNumber === 1 ? "session_start" : `stop_${card.stopNumber - 1}`,
      to: `stop_${card.stopNumber}`,
      drive_sec: card.drive_since_prev_sec,
      miles: card.miles_since_prev,
      label:
        card.stopNumber === 1
          ? "Driving before first stop"
          : `Driving between Stop ${card.stopNumber - 1} and Stop ${card.stopNumber}`,
    });
  }
  if (session?.ended_at || !session?.active) {
    driveLegs.push({
      type: "drive",
      from: last ? `stop_${last.stopNumber}` : "session_start",
      to: "session_end",
      drive_sec: afterLastDriveSec,
      miles: afterLastMiles,
      label: last ? "Driving after last stop" : "Driving (no stops)",
    });
  } else if (last && !last.open) {
    driveLegs.push({
      type: "drive",
      from: `stop_${last.stopNumber}`,
      to: "live",
      drive_sec: afterLastDriveSec,
      miles: afterLastMiles,
      label: "Driving since last stop",
    });
  }

  const betweenDriveSecs = enriched.map((c) => c.drive_since_prev_sec).filter((n) => n >= 0);
  const betweenMiles = enriched.map((c) => c.miles_since_prev).filter((n) => n >= 0);
  const stopDurations = enriched.map((c) => c.duration_sec);
  const allDriveGaps = [...betweenDriveSecs];
  if (afterLastDriveSec > 0) allDriveGaps.push(afterLastDriveSec);

  const totalStopSec = stopDurations.reduce((a, b) => a + b, 0);
  const totalDriveSec = sessionDrive > 0 ? sessionDrive : allDriveGaps.reduce((a, b) => a + b, 0);
  const totalSessionSec = secBetween(sessionStart, sessionEnd);

  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
  const avgF = (arr) =>
    arr.length ? round1(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  const summary = {
    totalStops: enriched.length,
    totalDrivingSec: totalDriveSec,
    totalStopSec,
    totalSessionSec,
    totalBusinessMiles: round1(sessionMiles),
    avgDriveBetweenStopsSec: avg(betweenDriveSecs),
    longestDriveBetweenStopsSec: allDriveGaps.length ? Math.max(...allDriveGaps) : 0,
    shortestDriveBetweenStopsSec: betweenDriveSecs.length ? Math.min(...betweenDriveSecs) : 0,
    avgMilesBetweenStops: avgF(betweenMiles),
    afterLastDriveSec,
    afterLastMiles,
  };

  const insights = {
    avgMinutesBetweenStops: Math.round((summary.avgDriveBetweenStopsSec / 60) * 10) / 10,
    avgMilesBetweenStops: summary.avgMilesBetweenStops,
    longestUninterruptedDriveSec: summary.longestDriveBetweenStopsSec,
    totalIdleSec: sessionIdle > 0 ? sessionIdle : totalStopSec,
    pctDriving:
      totalSessionSec > 0 ? Math.round((totalDriveSec / totalSessionSec) * 1000) / 10 : 0,
    pctStopped:
      totalSessionSec > 0 ? Math.round((totalStopSec / totalSessionSec) * 1000) / 10 : 0,
  };

  const timeline = buildSessionTimeline(session, enriched, {
    afterLastDriveSec,
    afterLastMiles,
    nowIso: sessionEnd,
  });

  return {
    stops: enriched,
    driveLegs,
    summary,
    insights,
    timeline,
    afterLast: { drive_sec: afterLastDriveSec, miles: afterLastMiles },
  };
}

export function buildSessionTimeline(session, enrichedStops = [], extras = {}) {
  const events = [];
  if (!session?.started_at) return events;

  events.push({
    type: "session_start",
    at: session.started_at,
    label: "Session started",
  });

  let cursor = session.started_at;
  for (const stop of enrichedStops) {
    events.push({
      type: "driving",
      at: cursor,
      ends_at: stop.arrived_at,
      label:
        stop.stopNumber === 1
          ? "Driving before first stop"
          : `Driving to Stop ${stop.stopNumber}`,
      drive_sec: stop.drive_since_prev_sec,
      miles: stop.miles_since_prev,
    });
    events.push({
      type: "stop",
      at: stop.arrived_at,
      ends_at: stop.departed_at,
      label: stop.label,
      stopNumber: stop.stopNumber,
      duration_sec: stop.duration_sec,
      open: stop.open,
    });
    cursor = stop.departed_at || stop.arrived_at;
  }

  const afterDrive = Number(extras.afterLastDriveSec || 0);
  const afterMiles = Number(extras.afterLastMiles || 0);
  const endAt = session.ended_at || extras.nowIso;

  if (enrichedStops.length === 0) {
    events.push({
      type: "driving",
      at: session.started_at,
      ends_at: endAt,
      label: "Driving",
      drive_sec: Number(session.drive_sec || 0),
      miles: Number(session.miles || 0),
    });
  } else if (afterDrive > 0 || afterMiles > 0 || session.ended_at) {
    const last = enrichedStops[enrichedStops.length - 1];
    if (last && !last.open) {
      events.push({
        type: "driving",
        at: last.departed_at || last.arrived_at,
        ends_at: endAt,
        label: session.ended_at ? "Driving after last stop" : "Driving since last stop",
        drive_sec: afterDrive,
        miles: afterMiles,
      });
    }
  }

  if (session.ended_at) {
    events.push({
      type: "session_end",
      at: session.ended_at,
      label: "Session ended",
    });
  }

  return events;
}

export function summarizeBetweenStopsDaily(sessions = []) {
  const driveGaps = [];
  const mileGaps = [];
  let totalStops = 0;
  let totalDrive = 0;
  let totalStop = 0;
  let totalWall = 0;
  let totalMiles = 0;

  for (const s of sessions) {
    const report = buildStopLegReport(s, s.stops || s.stops_detail || [], {
      now: s.ended_at || s.started_at,
    });
    totalStops += report.summary.totalStops;
    totalDrive += report.summary.totalDrivingSec;
    totalStop += report.summary.totalStopSec;
    totalWall += report.summary.totalSessionSec;
    totalMiles = round1(totalMiles + report.summary.totalBusinessMiles);
    for (const st of report.stops) {
      driveGaps.push(st.drive_since_prev_sec);
      mileGaps.push(st.miles_since_prev);
    }
    if (report.afterLast?.drive_sec > 0) driveGaps.push(report.afterLast.drive_sec);
    if (report.afterLast?.miles > 0) mileGaps.push(report.afterLast.miles);
  }

  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
  const avgF = (arr) =>
    arr.length ? round1(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  return {
    totalStops,
    totalDrivingSec: totalDrive,
    totalStopSec: totalStop,
    totalSessionSec: totalWall,
    totalBusinessMiles: totalMiles,
    avgDriveTimeBetweenStopsSec: avg(driveGaps),
    longestDriveBetweenStopsSec: driveGaps.length ? Math.max(...driveGaps) : 0,
    shortestDriveBetweenStopsSec: driveGaps.length ? Math.min(...driveGaps) : 0,
    avgDistanceBetweenStops: avgF(mileGaps),
  };
}
