import { readLocal, writeLocal } from "../localStore.js";

const PREFIX = "titanos_driver";
const IMPORT_KEY = "imported_records_v1";
const MAX_RECORDS = 10000;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

export const DRIVER_RECORD_ACCEPT =
  ".csv,.txt,.json,.pdf,text/csv,text/plain,application/json,application/pdf";

const PLATFORM_PATTERNS = [
  ["doordash", /door\s*dash|dasher/i],
  ["uber_eats", /uber\s*eats/i],
  ["uber", /\buber\b/i],
  ["lyft", /\blyft\b/i],
  ["spark", /\bspark\b|walmart/i],
  ["instacart", /instacart/i],
  ["grubhub", /grub\s*hub/i],
  ["amazon_flex", /amazon\s*flex/i],
  ["roadie", /roadie/i],
  ["shipt", /\bshipt\b/i],
];

export const PLATFORM_LABELS = Object.freeze({
  doordash: "DoorDash",
  uber_eats: "Uber Eats",
  uber: "Uber",
  lyft: "Lyft",
  spark: "Spark",
  instacart: "Instacart",
  grubhub: "Grubhub",
  amazon_flex: "Amazon Flex",
  roadie: "Roadie",
  shipt: "Shipt",
  other: "Other",
  titanos: "TitanOS",
});

const FIELD_ALIASES = Object.freeze({
  date: ["date", "tripdate", "deliverydate", "completeddate", "transactiondate", "payoutdate", "timestamp"],
  started: ["startedat", "starttime", "tripstart", "requesttime", "pickuptime", "begintrip", "onlinefrom"],
  ended: ["endedat", "endtime", "tripend", "droptime", "dropofftime", "completedtime", "onlineto"],
  gross: ["gross", "grossearnings", "totalearnings", "earnings", "totalpay", "netearnings", "netpayout", "payout", "yourpay", "tripearnings", "amount"],
  base: ["basepay", "basefare", "fare", "deliverypay", "platformpay"],
  tips: ["tips", "tip", "customertip"],
  bonus: ["bonus", "promotion", "promotions", "incentive", "incentives", "surge", "peakpay"],
  miles: ["miles", "tripmiles", "totalmiles", "distance", "tripdistance", "onlinemiles", "bookedmiles"],
  active: ["activetime", "engagedtime", "tripduration", "deliveryduration", "duration", "activehours", "activeminutes"],
  online: ["onlinetime", "dashtime", "totalonline", "onlinehours", "onlineminutes"],
  trips: ["trips", "deliveries", "rides", "orders", "completedtrips"],
  platform: ["platform", "app", "service", "provider"],
});

function normalizedHeader(value) {
  return String(value || "").replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function safeNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const negative = /^\(.*\)$/.test(raw) || /^-/.test(raw);
  const parsed = Number(raw.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -parsed : parsed;
}

function durationSeconds(value, header = "") {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  if (/^\d{1,3}:\d{2}(?::\d{2})?$/.test(raw)) {
    const parts = raw.split(":").map(Number);
    return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 3600 + parts[1] * 60;
  }
  const hours = raw.match(/([\d.]+)\s*(?:h|hr|hour)/i);
  const minutes = raw.match(/([\d.]+)\s*(?:m|min|minute)/i);
  if (hours || minutes) return Math.round(safeNumber(hours?.[1]) * 3600 + safeNumber(minutes?.[1]) * 60);
  const number = safeNumber(raw);
  if (/minute|min$/i.test(header)) return Math.round(number * 60);
  if (/hour|hr$/i.test(header)) return Math.round(number * 3600);
  return Math.round(number * 60);
}

function isoDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function stableId(parts) {
  const text = parts.map((part) => String(part ?? "")).join("|");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `import_${(hash >>> 0).toString(36)}`;
}

function parseCsvMatrix(text = "") {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text).replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"' && quoted && source[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function inferPlatform(source = "") {
  return PLATFORM_PATTERNS.find(([, pattern]) => pattern.test(source))?.[0] || "other";
}

function columnIndex(headers, aliases) {
  return headers.findIndex((header) => aliases.some((alias) => header === alias || header.startsWith(alias) || header.endsWith(alias)));
}

function valueAt(row, indexes, field) {
  const index = indexes[field];
  return index >= 0 ? row[index] : "";
}

function normalizeRow(row, headers, indexes, meta, rowIndex) {
  const rawStarted = valueAt(row, indexes, "started");
  const rawEnded = valueAt(row, indexes, "ended");
  const rawDate = valueAt(row, indexes, "date") || rawStarted || rawEnded;
  const startedAt = isoDate(rawStarted || rawDate);
  const endedAt = isoDate(rawEnded);
  const base = safeNumber(valueAt(row, indexes, "base"));
  const tips = safeNumber(valueAt(row, indexes, "tips"));
  const bonus = safeNumber(valueAt(row, indexes, "bonus"));
  const explicitGross = safeNumber(valueAt(row, indexes, "gross"));
  const gross = explicitGross || base + tips + bonus;
  const milesHeader = indexes.miles >= 0 ? headers[indexes.miles] : "";
  let miles = safeNumber(valueAt(row, indexes, "miles"));
  if (/km|kilometer/.test(milesHeader)) miles *= 0.621371;
  let activeSec = durationSeconds(valueAt(row, indexes, "active"), indexes.active >= 0 ? headers[indexes.active] : "");
  const onlineSec = durationSeconds(valueAt(row, indexes, "online"), indexes.online >= 0 ? headers[indexes.online] : "");
  if (!activeSec && startedAt && endedAt) activeSec = Math.max(0, Math.round((new Date(endedAt) - new Date(startedAt)) / 1000));
  const tripCount = Math.max(1, Math.round(safeNumber(valueAt(row, indexes, "trips")) || 1));
  const rowPlatform = inferPlatform(valueAt(row, indexes, "platform")) || meta.platform;
  if (!(gross || miles || activeSec || onlineSec)) return null;
  const date = startedAt || isoDate(rawDate) || meta.importedAt;
  return {
    id: stableId([meta.fileName, rowIndex, date, gross, miles, meta.platform]),
    source: "platform_import",
    source_file: meta.fileName,
    imported_at: meta.importedAt,
    platform: rowPlatform === "other" ? meta.platform : rowPlatform,
    date: date.slice(0, 10),
    started_at: startedAt,
    ended_at: endedAt,
    gross: Math.round(gross * 100) / 100,
    tips: Math.round(tips * 100) / 100,
    miles: Math.round(miles * 10) / 10,
    active_sec: activeSec,
    online_sec: onlineSec || activeSec,
    trip_count: tripCount,
  };
}

export function parseDriverCsv(text, { fileName = "records.csv", importedAt = new Date().toISOString() } = {}) {
  const matrix = parseCsvMatrix(text);
  if (matrix.length < 2) return [];
  const headers = matrix[0].map(normalizedHeader);
  const indexes = Object.fromEntries(Object.entries(FIELD_ALIASES).map(([field, aliases]) => [field, columnIndex(headers, aliases)]));
  if (!["gross", "base", "miles", "active", "online"].some((field) => indexes[field] >= 0)) return [];
  const platform = inferPlatform(`${fileName} ${matrix[0].join(" ")} ${String(text).slice(0, 500)}`);
  return matrix.slice(1).map((row, index) => normalizeRow(row, headers, indexes, { fileName, importedAt, platform }, index + 1)).filter(Boolean);
}

function summaryValue(text, labels, kind = "number") {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*[:=-]?\\s*(?:USD\\s*)?\\$?([\\d,.]+(?:\\s*(?:hours?|hrs?|minutes?|mins?|miles?|mi))?)`, "i");
    const match = String(text).match(pattern);
    if (!match) continue;
    if (kind === "duration") return durationSeconds(match[1]);
    return safeNumber(match[1]);
  }
  return 0;
}

export function parseDriverText(text, { fileName = "records.txt", importedAt = new Date().toISOString() } = {}) {
  const csvRows = parseDriverCsv(text, { fileName, importedAt });
  if (csvRows.length) return csvRows;
  const platform = inferPlatform(`${fileName} ${String(text).slice(0, 2000)}`);
  const gross = summaryValue(text, ["total earnings", "net earnings", "gross earnings", "total pay", "payout", "earnings"]);
  const miles = summaryValue(text, ["online miles", "total miles", "booked miles", "miles", "distance"]);
  const activeSec = summaryValue(text, ["active time", "engaged time", "trip time", "active hours"], "duration");
  const onlineSec = summaryValue(text, ["online time", "dash time", "online hours"], "duration") || activeSec;
  const tripCount = Math.max(1, Math.round(summaryValue(text, ["completed trips", "deliveries", "orders", "rides", "trips"]) || 1));
  const dateMatch = String(text).match(/\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]20\d{2})\b/);
  if (!(gross || miles || activeSec || onlineSec)) return [];
  const date = isoDate(dateMatch?.[1]) || importedAt;
  return [{
    id: stableId([fileName, date, gross, miles, platform]), source: "platform_import", source_file: fileName,
    imported_at: importedAt, platform, date: date.slice(0, 10), started_at: null, ended_at: null,
    gross: Math.round(gross * 100) / 100, tips: 0, miles: Math.round(miles * 10) / 10,
    active_sec: activeSec, online_sec: onlineSec, trip_count: tripCount,
  }];
}

function collectJsonRows(value, output = []) {
  if (Array.isArray(value)) value.forEach((item) => collectJsonRows(item, output));
  else if (value && typeof value === "object") {
    const aliases = Object.values(FIELD_ALIASES).flat();
    const hasRecordField = Object.entries(value).some(([key, item]) =>
      (item == null || ["string", "number", "boolean"].includes(typeof item)) && aliases.includes(normalizedHeader(key))
    );
    if (hasRecordField) output.push(value);
    else Object.values(value).forEach((item) => collectJsonRows(item, output));
  }
  return output;
}

export function parseDriverJson(text, { fileName = "records.json", importedAt = new Date().toISOString() } = {}) {
  const objects = collectJsonRows(JSON.parse(text));
  if (!objects.length) return [];
  const headers = [...new Set(objects.flatMap((row) => Object.keys(row)))];
  const csv = [headers.join(","), ...objects.map((row) => headers.map((key) => JSON.stringify(row[key] ?? "")).join(","))].join("\n");
  return parseDriverCsv(csv, { fileName, importedAt });
}

async function extractPdfText(file) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerUrl = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.default;
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  if (document.numPages > 100) throw new Error("PDF is too long. Choose a statement with 100 pages or fewer.");
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }
  return pages.join("\n");
}

export async function parseDriverRecordFile(file) {
  if (!file) return [];
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 15 MB.`);
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["csv", "txt", "json", "pdf"].includes(extension)) throw new Error(`${file.name}: choose CSV, PDF, TXT, or JSON.`);
  const importedAt = new Date().toISOString();
  const text = extension === "pdf" ? await extractPdfText(file) : await file.text();
  if (extension === "csv") return parseDriverCsv(text, { fileName: file.name, importedAt });
  if (extension === "json") return parseDriverJson(text, { fileName: file.name, importedAt });
  return parseDriverText(text, { fileName: file.name, importedAt });
}

export function listImportedDriverRecords(userId) {
  const rows = readLocal(PREFIX, userId, IMPORT_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

export function mergeImportedDriverRecords(userId, records = []) {
  const existing = listImportedDriverRecords(userId);
  const map = new Map(existing.map((row) => [row.id, row]));
  let added = 0;
  for (const row of records) {
    if (!row?.id || map.has(row.id)) continue;
    map.set(row.id, row);
    added += 1;
  }
  const rows = [...map.values()].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, MAX_RECORDS);
  writeLocal(PREFIX, userId, IMPORT_KEY, rows);
  return { rows, added, skipped: Math.max(0, records.length - added) };
}

export function clearImportedDriverRecords(userId) {
  writeLocal(PREFIX, userId, IMPORT_KEY, []);
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function scale(value, low, high) {
  return clamp((Number(value) - low) / (high - low));
}

export function summarizeDriverPerformance(records = [], { costPerMile = 0.35, includePlatforms = true } = {}) {
  const valid = (Array.isArray(records) ? records : []).filter((row) => row && (Number(row.gross ?? row.earnings) || Number(row.miles) || Number(row.active_sec ?? row.drive_sec)));
  const sum = (getter) => valid.reduce((total, row) => total + (Number(getter(row)) || 0), 0);
  const gross = sum((row) => row.gross ?? ((Number(row.earnings) || 0) + (Number(row.tips) || 0)));
  const miles = sum((row) => row.miles);
  const activeSec = sum((row) => row.active_sec ?? row.drive_sec ?? row.elapsed_sec);
  const onlineSec = sum((row) => row.online_sec ?? row.elapsed_sec ?? row.active_sec ?? row.drive_sec);
  const trips = Math.round(sum((row) => row.trip_count || 1));
  const operatingCost = miles * Math.max(0, Number(costPerMile) || 0);
  const profit = gross - operatingCost;
  const activeHours = activeSec / 3600;
  const profitPerHour = activeHours > 0 ? profit / activeHours : 0;
  const profitPerMile = miles > 0 ? profit / miles : 0;
  const utilization = onlineSec > 0 ? clamp(activeSec / onlineSec) : activeSec > 0 ? 0.7 : 0;
  const profitMargin = gross > 0 ? clamp(profit / gross) : 0;
  const complete = valid.filter((row) => Number(row.gross ?? row.earnings) > 0 && Number(row.miles) > 0 && Number(row.active_sec ?? row.drive_sec ?? row.elapsed_sec) > 0).length;
  const dataCompleteness = valid.length ? complete / valid.length : 0;
  const components = {
    hourly: Math.round(scale(profitPerHour, 8, 30) * 30),
    mileage: Math.round(scale(profitPerMile, 0.3, 2) * 25),
    utilization: Math.round(scale(utilization, 0.35, 0.85) * 20),
    margin: Math.round(scale(profitMargin, 0.2, 0.75) * 15),
    confidence: Math.round(Math.min(10, (Math.log10(trips + 1) / Math.log10(51)) * 10) * (0.6 + dataCompleteness * 0.4)),
  };
  const score = valid.length ? Object.values(components).reduce((total, value) => total + value, 0) : null;
  const byPlatform = new Map();
  for (const row of valid) {
    const platform = row.platform || row.app || "other";
    if (!byPlatform.has(platform)) byPlatform.set(platform, []);
    byPlatform.get(platform).push(row);
  }
  const platforms = includePlatforms ? [...byPlatform.entries()].map(([platform, rows]) => {
    const summary = summarizeDriverPerformance(rows, { costPerMile, includePlatforms: false });
    return { platform, label: PLATFORM_LABELS[platform] || platform, trips: summary.trips, gross: summary.gross, profit: summary.profit, profitPerHour: summary.profitPerHour, profitPerMile: summary.profitPerMile };
  }).sort((a, b) => b.profitPerHour - a.profitPerHour) : [];
  const dates = valid.map((row) => new Date(row.date || row.started_at || 0).getTime()).filter(Number.isFinite);
  const periodDays = dates.length ? Math.max(1, Math.ceil((Math.max(...dates) - Math.min(...dates)) / 86400000) + 1) : 0;
  return {
    score, components, gross: Math.round(gross * 100) / 100, operatingCost: Math.round(operatingCost * 100) / 100,
    profit: Math.round(profit * 100) / 100, miles: Math.round(miles * 10) / 10, activeHours: Math.round(activeHours * 10) / 10,
    profitPerHour: Math.round(profitPerHour * 100) / 100, profitPerMile: Math.round(profitPerMile * 100) / 100,
    utilization: Math.round(utilization * 100), dataCompleteness: Math.round(dataCompleteness * 100), trips, platforms, periodDays,
  };
}
