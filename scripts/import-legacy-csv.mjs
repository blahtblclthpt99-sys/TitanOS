#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, basename, relative } from "node:path";

const ROOT = process.cwd();

function loadEnvFiles() {
  const env = { ...process.env };
  for (const file of [".env.local", ".env"]) {
    const path = resolve(ROOT, file);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      const key = match[1];
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in env) || file === ".env.local") env[key] = value;
    }
  }
  return env;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function normalizeSupabaseUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  const noTrail = value.replace(/\/+$/, "");
  return noTrail.replace(/\/rest\/v1$/i, "");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  if (!rows.length) return [];
  const header = rows[0].map((x) => String(x || "").trim());
  const body = rows.slice(1).filter((r) => r.some((v) => String(v || "").trim() !== ""));
  return body.map((values) => {
    const out = {};
    for (let i = 0; i < header.length; i += 1) {
      out[header[i]] = (values[i] ?? "").trim();
    }
    return out;
  });
}

function parseJsonMaybe(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function dateOnly(value) {
  if (!value) return null;
  const iso = String(value).trim();
  if (!iso) return null;
  return iso.includes("T") ? iso.slice(0, 10) : iso;
}

function ts(value) {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function splitName(fullName) {
  const raw = String(fullName || "").trim();
  if (!raw) return { first_name: "Customer", last_name: "Unknown" };
  const parts = raw.split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0], last_name: "Unknown" };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

function normalizeEquipmentStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "active";
  if (raw === "active") return "active";
  if (raw === "maintenance") return "service";
  if (raw === "service") return "service";
  if (raw === "retired") return "retired";
  if (raw === "lost") return "lost";
  return "active";
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableRowHash(row) {
  return sha256(JSON.stringify(row, Object.keys(row).sort()));
}

async function archiveRows(sb, table, sourceFile, rows) {
  if (!rows.length) return { inserted: 0 };
  const payload = rows.map((row) => ({
    source_file: sourceFile,
    source_id: row.id || null,
    source_hash: stableRowHash(row),
    payload: row,
  }));

  const { data, error } = await sb
    .from(table)
    .upsert(payload, { onConflict: "source_file,source_hash", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(`archive ${table} failed: ${error.message}`);
  return { inserted: data?.length || 0 };
}

async function existingSourceIds(sb, entityName, sourceIds) {
  if (!sourceIds.length) return new Set();
  const { data, error } = await sb
    .from("legacy_import_id_map")
    .select("source_id")
    .eq("entity_name", entityName)
    .in("source_id", sourceIds);
  if (error) throw new Error(`id map lookup failed for ${entityName}: ${error.message}`);
  return new Set((data || []).map((x) => x.source_id));
}

async function recordIdMap(sb, maps) {
  if (!maps.length) return;
  const { error } = await sb
    .from("legacy_import_id_map")
    .upsert(maps, { onConflict: "entity_name,source_id", ignoreDuplicates: true });
  if (error) throw new Error(`id map upsert failed: ${error.message}`);
}

async function importCustomers(sb, rows, ownerUserId, sourceFile) {
  const entityName = "Customer";
  const sourceIds = rows.map((r) => r.id).filter(Boolean);
  const seen = await existingSourceIds(sb, entityName, sourceIds);
  const fresh = rows.filter((r) => !r.id || !seen.has(r.id));
  if (!fresh.length) return { inserted: 0, skipped: rows.length };

  const payload = fresh.map((r) => {
    const split = splitName(r.name);
    return {
      first_name: split.first_name,
      last_name: split.last_name,
      email: r.email || null,
      phone: r.phone || null,
      address: r.address || null,
      notes: r.notes || null,
      status: r.status || "lead",
      source: "legacy_csv_import",
      created_by_id: ownerUserId,
      created_at: ts(r.created_date),
      updated_at: ts(r.updated_date),
    };
  });

  const { data, error } = await sb.from("customers").insert(payload).select("id");
  if (error) throw new Error(`customers insert failed: ${error.message}`);

  const maps = data.map((d, i) => ({
    entity_name: entityName,
    source_id: fresh[i].id || `generated:${stableRowHash(fresh[i])}`,
    target_table: "customers",
    target_id: d.id,
    source_file: sourceFile,
    payload: fresh[i],
  }));
  await recordIdMap(sb, maps);
  return { inserted: data.length, skipped: rows.length - data.length };
}

async function importJobs(sb, rows, ownerUserId, sourceFile) {
  const entityName = "Job";
  const sourceIds = rows.map((r) => r.id).filter(Boolean);
  const seen = await existingSourceIds(sb, entityName, sourceIds);
  const fresh = rows.filter((r) => !r.id || !seen.has(r.id));
  if (!fresh.length) return { inserted: 0, skipped: rows.length };

  const payload = fresh.map((r) => ({
    title: r.title || "Imported job",
    description: r.description || null,
    customer_id: r.customer_id || null,
    customer_name: r.customer_name || null,
    status: r.status || "scheduled",
    priority: r.priority || "medium",
    scheduled_date: dateOnly(r.scheduled_date),
    address: r.address || null,
    amount: num(r.estimated_value, 0),
    notes: r.notes || null,
    checklist: parseJsonMaybe(r.checklist, []),
    created_by_id: ownerUserId,
    created_at: ts(r.created_date),
    updated_at: ts(r.updated_date),
  }));

  const { data, error } = await sb.from("jobs").insert(payload).select("id");
  if (error) throw new Error(`jobs insert failed: ${error.message}`);

  const maps = data.map((d, i) => ({
    entity_name: entityName,
    source_id: fresh[i].id || `generated:${stableRowHash(fresh[i])}`,
    target_table: "jobs",
    target_id: d.id,
    source_file: sourceFile,
    payload: fresh[i],
  }));
  await recordIdMap(sb, maps);
  return { inserted: data.length, skipped: rows.length - data.length };
}

async function importInvoices(sb, rows, ownerUserId, sourceFile) {
  const entityName = "Invoice";
  const sourceIds = rows.map((r) => r.id).filter(Boolean);
  const seen = await existingSourceIds(sb, entityName, sourceIds);
  const fresh = rows.filter((r) => !r.id || !seen.has(r.id));
  if (!fresh.length) return { inserted: 0, skipped: rows.length };

  const payload = fresh.map((r) => ({
    invoice_number: r.number || null,
    customer_id: r.customer_id || null,
    customer_name: r.customer_name || null,
    job_id: r.job_id || null,
    status: r.status || "draft",
    line_items: parseJsonMaybe(r.line_items, []),
    subtotal: num(r.subtotal, 0),
    tax_rate: num(r.tax_rate, 0),
    tax_amount: num(r.tax_amount, 0),
    total: num(r.total, 0),
    due_date: dateOnly(r.due_date),
    notes: r.notes || null,
    created_by_id: ownerUserId,
    created_at: ts(r.created_date),
    updated_at: ts(r.updated_date),
  }));

  const { data, error } = await sb.from("invoices").insert(payload).select("id");
  if (error) throw new Error(`invoices insert failed: ${error.message}`);

  const maps = data.map((d, i) => ({
    entity_name: entityName,
    source_id: fresh[i].id || `generated:${stableRowHash(fresh[i])}`,
    target_table: "invoices",
    target_id: d.id,
    source_file: sourceFile,
    payload: fresh[i],
  }));
  await recordIdMap(sb, maps);
  return { inserted: data.length, skipped: rows.length - data.length };
}

async function importExpenses(sb, rows, ownerUserId, sourceFile) {
  const entityName = "Expense";
  const sourceIds = rows.map((r) => r.id).filter(Boolean);
  const seen = await existingSourceIds(sb, entityName, sourceIds);
  const fresh = rows.filter((r) => !r.id || !seen.has(r.id));
  if (!fresh.length) return { inserted: 0, skipped: rows.length };

  const payload = fresh.map((r) => ({
    description: r.description || "Imported expense",
    amount: num(r.amount, 0),
    category: r.category || "other",
    date: dateOnly(r.date),
    vendor: r.vendor || null,
    receipt_url: r.receipt_url || null,
    notes: null,
    created_by_id: ownerUserId,
    created_at: ts(r.created_date),
    updated_at: ts(r.updated_date),
  }));

  const { data, error } = await sb.from("expenses").insert(payload).select("id");
  if (error) throw new Error(`expenses insert failed: ${error.message}`);

  const maps = data.map((d, i) => ({
    entity_name: entityName,
    source_id: fresh[i].id || `generated:${stableRowHash(fresh[i])}`,
    target_table: "expenses",
    target_id: d.id,
    source_file: sourceFile,
    payload: fresh[i],
  }));
  await recordIdMap(sb, maps);
  return { inserted: data.length, skipped: rows.length - data.length };
}

async function importVehiclesAsEquipment(sb, rows, ownerUserId, sourceFile) {
  const entityName = "Vehicle";
  const sourceIds = rows.map((r) => r.id).filter(Boolean);
  const seen = await existingSourceIds(sb, entityName, sourceIds);
  const fresh = rows.filter((r) => !r.id || !seen.has(r.id));
  if (!fresh.length) return { inserted: 0, skipped: rows.length };

  const payload = fresh.map((r) => ({
    user_id: ownerUserId,
    created_by_id: ownerUserId,
    name: [r.year, r.make, r.model].filter(Boolean).join(" ") || r.license_plate || "Imported vehicle",
    category: "vehicle",
    brand: r.make || "",
    model: r.model || "",
    year: Number.isFinite(Number(r.year)) ? Number(r.year) : null,
    serial_number: r.license_plate || "",
    status: normalizeEquipmentStatus(r.status),
    next_service_date: dateOnly(r.next_service_date),
    notes: [r.assigned_driver_name ? `Assigned: ${r.assigned_driver_name}` : "", r.service_records ? `Service records: ${r.service_records}` : ""].filter(Boolean).join(" | "),
    created_at: ts(r.created_date),
    updated_at: ts(r.updated_date),
  }));

  let data;
  {
    const firstTry = await sb.from("equipment").insert(payload).select("id");
    if (!firstTry.error) {
      data = firstTry.data;
    } else if (/year/i.test(firstTry.error.message || "")) {
      const withoutYear = payload.map((row) => {
        const { year, ...rest } = row;
        return rest;
      });
      const secondTry = await sb.from("equipment").insert(withoutYear).select("id");
      if (secondTry.error) {
        throw new Error(`equipment insert failed: ${secondTry.error.message}`);
      }
      data = secondTry.data;
    } else {
      throw new Error(`equipment insert failed: ${firstTry.error.message}`);
    }
  }

  const maps = data.map((d, i) => ({
    entity_name: entityName,
    source_id: fresh[i].id || `generated:${stableRowHash(fresh[i])}`,
    target_table: "equipment",
    target_id: d.id,
    source_file: sourceFile,
    payload: fresh[i],
  }));
  await recordIdMap(sb, maps);
  return { inserted: data.length, skipped: rows.length - data.length };
}

function findPythonLearningScripts(rootDir) {
  const out = [];
  for (const name of readdirSync(rootDir)) {
    const abs = join(rootDir, name);
    const st = statSync(abs);
    if (st.isDirectory()) continue;
    if (!name.endsWith(".py")) continue;
    if (name.startsWith("test_")) continue;
    out.push(abs);
  }
  return out;
}

async function archiveLearningScripts(sb, rootDir) {
  const paths = findPythonLearningScripts(rootDir);
  if (!paths.length) return { found: 0, inserted: 0 };
  const rows = paths.map((absPath) => {
    const scriptText = readFileSync(absPath, "utf8");
    return {
      relative_path: relative(rootDir, absPath).replace(/\\/g, "/"),
      script_name: basename(absPath),
      content_sha256: sha256(scriptText),
      script_text: scriptText,
    };
  });
  const { data, error } = await sb
    .from("legacy_learning_scripts")
    .upsert(rows, { onConflict: "relative_path,content_sha256", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(`learning scripts archive failed: ${error.message}`);
  return { found: rows.length, inserted: data?.length || 0 };
}

async function detectOwnerUserId(sb) {
  const { data, error } = await sb
    .from("profiles")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw new Error(`owner auto-detect failed: ${error.message}`);
  const id = data?.[0]?.id;
  if (!id) throw new Error("owner auto-detect failed: no profile row found");
  return id;
}

async function assertLegacyTablesReady(sb) {
  const { error } = await sb
    .from("legacy_import_id_map")
    .select("id", { head: true, count: "exact" });
  if (error) {
    throw new Error(
      "Legacy import tables are missing. Apply supabase/migrations/039_legacy_csv_archives.sql first."
    );
  }
}

async function main() {
  const env = loadEnvFiles();
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = args.sourceDir
    ? resolve(String(args.sourceDir))
    : resolve(env.USERPROFILE || "", "Downloads");
  let ownerUserId = String(args.ownerUserId || env.MIGRATION_OWNER_USER_ID || "").trim();
  const includeLearningScripts = Boolean(args.archiveLearningScripts);

  const supabaseUrl = normalizeSupabaseUrl(env.VITE_SUPABASE_URL || env.SUPABASE_URL);
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) {
    throw new Error("Missing VITE_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  const sb = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

  await assertLegacyTablesReady(sb);

  if (!ownerUserId) {
    ownerUserId = await detectOwnerUserId(sb);
    console.log(JSON.stringify({ ownerUserIdAutoDetected: ownerUserId }));
  }

  const filePlan = [
    {
      file: "Customer_export.csv",
      mapped: (rows) => importCustomers(sb, rows, ownerUserId, "Customer_export.csv"),
      archiveTable: null,
    },
    {
      file: "Job_export.csv",
      mapped: (rows) => importJobs(sb, rows, ownerUserId, "Job_export.csv"),
      archiveTable: null,
    },
    {
      file: "Invoice_export.csv",
      mapped: (rows) => importInvoices(sb, rows, ownerUserId, "Invoice_export.csv"),
      archiveTable: null,
    },
    {
      file: "Expense_export.csv",
      mapped: (rows) => importExpenses(sb, rows, ownerUserId, "Expense_export.csv"),
      archiveTable: null,
    },
    {
      file: "Vehicle_export.csv",
      mapped: (rows) => importVehiclesAsEquipment(sb, rows, ownerUserId, "Vehicle_export.csv"),
      archiveTable: null,
    },
    { file: "VehicleCapacity_export.csv", mapped: null, archiveTable: "legacy_vehicle_capacity" },
    { file: "AreaStat_export.csv", mapped: null, archiveTable: "legacy_area_stats" },
    { file: "AuditLog_export.csv", mapped: null, archiveTable: "legacy_audit_logs" },
    { file: "Base44Purchase_export.csv", mapped: null, archiveTable: "legacy_base44_purchases" },
    { file: "FuelLog_export.csv", mapped: null, archiveTable: "legacy_fuel_logs" },
    { file: "GigOrder_export.csv", mapped: null, archiveTable: "legacy_gig_orders" },
    { file: "Reminder_export (1).csv", mapped: null, archiveTable: "legacy_reminders" },
    { file: "Shift_export.csv", mapped: null, archiveTable: "legacy_shifts" },
    { file: "TeamMember_export.csv", mapped: null, archiveTable: "legacy_team_members" },
  ];

  const report = {
    startedAt: new Date().toISOString(),
    sourceDir,
    ownerUserId,
    files: [],
    learningScripts: null,
  };

  for (const step of filePlan) {
    const abs = join(sourceDir, step.file);
    if (!existsSync(abs)) {
      report.files.push({ file: step.file, status: "missing", rows: 0, inserted: 0, skipped: 0 });
      continue;
    }

    const text = readFileSync(abs, "utf8");
    const rows = parseCsv(text);
    if (!rows.length) {
      report.files.push({ file: step.file, status: "empty", rows: 0, inserted: 0, skipped: 0 });
      continue;
    }

    let mapped = { inserted: 0, skipped: 0 };
    if (step.mapped) {
      mapped = await step.mapped(rows);
    }

    let archived = { inserted: 0 };
    if (step.archiveTable) {
      archived = await archiveRows(sb, step.archiveTable, step.file, rows);
    }

    report.files.push({
      file: step.file,
      status: "ok",
      rows: rows.length,
      mappedInserted: mapped.inserted,
      mappedSkipped: mapped.skipped,
      archivedInserted: archived.inserted,
    });
  }

  if (includeLearningScripts) {
    report.learningScripts = await archiveLearningScripts(sb, ROOT);
  }

  report.finishedAt = new Date().toISOString();
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error.message }, null, 2));
  process.exit(1);
});