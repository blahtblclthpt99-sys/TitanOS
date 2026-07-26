/**
 * Zip-based pay averages from this driver's logged trips & sessions.
 * Powers ACCEPT/DENY by comparing an offer to what that ZIP usually pays.
 */

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Normalize to 5-digit US ZIP when possible. */
export function normalizeZip(raw) {
  if (raw == null) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length >= 5) return digits.slice(0, 5);
  const alnum = String(raw).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return alnum.slice(0, 7);
}

/** Pull a ZIP from common trip/session shapes or a trailing 5 digits in a label. */
export function extractZip(record, fallbackZip = "") {
  if (!record || typeof record !== "object") return normalizeZip(fallbackZip);
  const labelMatch = String(record.label || record.notes || "").match(/\b(\d{5})(?:-\d{4})?\b/);
  const candidates = [
    record.zip,
    record.dropoff_zip,
    record.pickup_zip,
    record.raw?.zip,
    record.session_zip,
    labelMatch?.[1],
    fallbackZip,
  ];
  for (const c of candidates) {
    const z = normalizeZip(c);
    if (z) return z;
  }
  return "";
}

function emptyBucket() {
  return {
    trips: 0,
    earnings: 0,
    miles: 0,
    drive_sec: 0,
    minutes: 0,
  };
}

function finalizeBucket(b) {
  const trips = b.trips;
  const earnings = Math.round(b.earnings * 100) / 100;
  const miles = Math.round(b.miles * 10) / 10;
  const drive_sec = Math.round(b.drive_sec);
  const hours = drive_sec / 3600;
  return {
    trips,
    earnings,
    miles,
    drive_sec,
    avg_pay: trips > 0 ? Math.round((earnings / trips) * 100) / 100 : null,
    avg_per_mile: miles > 0 && earnings > 0 ? Math.round((earnings / miles) * 100) / 100 : null,
    avg_per_hour: hours > 0 && earnings > 0 ? Math.round((earnings / hours) * 100) / 100 : null,
    avg_minutes:
      trips > 0 && (b.minutes > 0 || drive_sec > 0)
        ? Math.round((b.minutes > 0 ? b.minutes : drive_sec / 60) / trips)
        : null,
  };
}

function accrue(bucket, { pay, miles, driveSec, minutes }) {
  if (pay <= 0) return;
  bucket.trips += 1;
  bucket.earnings += pay;
  bucket.miles += Math.max(0, miles);
  bucket.drive_sec += Math.max(0, driveSec);
  bucket.minutes += Math.max(0, minutes);
}

/**
 * Build overall + per-ZIP averages from journal rows and Hub sessions.
 * Only rows with logged earnings count (so averages reflect real payouts).
 */
export function buildZipBenchmarks({
  journal = [],
  sessions = [],
  fallbackZip = "",
} = {}) {
  const byZip = new Map();
  const overall = emptyBucket();
  const journalWithPay = (Array.isArray(journal) ? journal : []).filter(
    (r) => num(r.earnings) + num(r.tips) > 0
  );
  const journalSessionIds = new Set(
    journalWithPay.map((r) => r.session_id).filter(Boolean)
  );

  const touch = (zipKey, sample) => {
    const key = zipKey || "unknown";
    if (!byZip.has(key)) byZip.set(key, emptyBucket());
    accrue(byZip.get(key), sample);
    accrue(overall, sample);
  };

  for (const row of journalWithPay) {
    const pay = num(row.earnings) + num(row.tips);
    const miles = num(row.miles);
    const driveSec = num(row.drive_sec) || num(row.active_sec);
    const minutes =
      num(row.minutes) ||
      (driveSec > 0 ? driveSec / 60 : 0) ||
      (num(row.idle_sec) + driveSec) / 60;
    touch(extractZip(row, fallbackZip), { pay, miles, driveSec, minutes });
  }

  for (const s of Array.isArray(sessions) ? sessions : []) {
    const pay = num(s.earnings_gross ?? s.earnings) + num(s.tips);
    if (pay <= 0) continue;
    // Prefer per-trip journal rows when that session already has logged pay
    if (s.id && journalSessionIds.has(s.id)) continue;
    const miles = num(s.miles ?? s.auto_miles);
    const driveSec = num(s.drive_sec) || num(s.elapsed_sec);
    const minutes = driveSec > 0 ? driveSec / 60 : num(s.hours) * 60;
    touch(extractZip(s, fallbackZip), { pay, miles, driveSec, minutes });
  }

  const byZipObj = {};
  for (const [zip, bucket] of byZip.entries()) {
    byZipObj[zip] = finalizeBucket(bucket);
  }

  const ranked = Object.entries(byZipObj)
    .filter(([z, b]) => z !== "unknown" && b.trips > 0)
    .map(([zip, stats]) => ({ zip, ...stats }))
    .sort((a, b) => (b.avg_per_mile || 0) - (a.avg_per_mile || 0));

  return {
    overall: finalizeBucket(overall),
    byZip: byZipObj,
    ranked,
    sample_trips: overall.trips,
    fallback_zip: normalizeZip(fallbackZip) || null,
  };
}

/**
 * Resolve the best benchmark for an offer ZIP (exact → 3-digit regional → overall).
 */
export function getZipBenchmark(benchmarks, zip) {
  const empty = {
    zip: null,
    source: "none",
    trips: 0,
    avg_pay: null,
    avg_per_mile: null,
    avg_per_hour: null,
    avg_minutes: null,
  };
  if (!benchmarks) return empty;
  const z = normalizeZip(zip);
  if (z && benchmarks.byZip?.[z]?.trips > 0) {
    return { zip: z, source: "zip", ...benchmarks.byZip[z] };
  }
  if (z && z.length >= 3) {
    const prefix = z.slice(0, 3);
    const matches = Object.entries(benchmarks.byZip || {}).filter(
      ([k, b]) => k.startsWith(prefix) && b.trips > 0
    );
    if (matches.length) {
      const merged = emptyBucket();
      for (const [, b] of matches) {
        merged.trips += b.trips;
        merged.earnings += b.earnings;
        merged.miles += b.miles;
        merged.drive_sec += b.drive_sec;
        merged.minutes += (b.avg_minutes || 0) * b.trips;
      }
      return { zip: `${prefix}xx`, source: "region", ...finalizeBucket(merged) };
    }
  }
  if (benchmarks.overall?.trips > 0) {
    return {
      zip: z || benchmarks.fallback_zip || null,
      source: "overall",
      ...benchmarks.overall,
    };
  }
  return { ...empty, zip: z || null };
}
