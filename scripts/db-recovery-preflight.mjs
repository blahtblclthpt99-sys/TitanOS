#!/usr/bin/env node
/**
 * TitanOS database recovery preflight.
 *
 * READ-ONLY by design. This script performs only HEAD/SELECT-style probes and
 * never creates users, inserts rows, updates records, deletes data, or applies
 * migrations. Run it before any mutation-based DB verification or recovery.
 *
 * Requires .env / .env.local with:
 *   VITE_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   node scripts/db-recovery-preflight.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

export const REQUIRED_CORE_TABLES = Object.freeze([
  "profiles",
  "customers",
  "jobs",
  "invoices",
  "estimates",
  "expenses",
  "employees",
  "mileage_trips",
  "payments",
  "companies",
  "company_members",
  "referrals",
  "equipment",
  "credentials",
]);

export const SUPPORT_TABLES = Object.freeze([
  "support_cases",
  "support_messages",
]);

export const ATTENTION_MARKER_TABLES = Object.freeze([
  "attention_profiles",
  "attention_campaigns",
  "attention_views",
  "attention_withdrawals",
  "attention_payment_events",
]);

function loadEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[match[1]] = value;
  }
  return out;
}

export function classifyRecoveryState({ required, support, attention }) {
  const requiredMissing = required.filter((item) => item.exists !== true);
  const requiredPresent = required.length - requiredMissing.length;
  const supportMissing = support.filter((item) => item.exists !== true);
  const attentionPresent = attention.filter((item) => item.exists === true);

  if (requiredMissing.length === 0) {
    return {
      state: attentionPresent.length ? "MIXED_TITANOS_AND_ATTENTION" : "TITANOS_CORE_PRESENT",
      safeForMutationProbes: supportMissing.length === 0,
      requiredPresent,
      requiredTotal: required.length,
      requiredMissing: [],
      supportMissing: supportMissing.map((item) => item.table),
      attentionPresent: attentionPresent.map((item) => item.table),
    };
  }

  if (requiredPresent === 0 && attentionPresent.length > 0) {
    return {
      state: "PURGED_OR_REPLACED",
      safeForMutationProbes: false,
      requiredPresent,
      requiredTotal: required.length,
      requiredMissing: requiredMissing.map((item) => item.table),
      supportMissing: supportMissing.map((item) => item.table),
      attentionPresent: attentionPresent.map((item) => item.table),
    };
  }

  return {
    state: "INCOMPLETE_OR_PARTIAL_TITANOS",
    safeForMutationProbes: false,
    requiredPresent,
    requiredTotal: required.length,
    requiredMissing: requiredMissing.map((item) => item.table),
    supportMissing: supportMissing.map((item) => item.table),
    attentionPresent: attentionPresent.map((item) => item.table),
  };
}

async function probeTable(client, table) {
  const { error } = await client
    .from(table)
    .select("*", { head: true, count: "exact" });

  if (!error) return { table, exists: true };

  const message = String(error.message || "");
  const missing =
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|could not find the table|schema cache/i.test(message);

  return {
    table,
    exists: missing ? false : "unknown",
    code: error.code || null,
    detail: message,
  };
}

async function probeMany(client, tables) {
  const results = [];
  for (const table of tables) results.push(await probeTable(client, table));
  return results;
}

export async function runRecoveryPreflight({ url, serviceKey }) {
  if (!url || !serviceKey) {
    throw new Error("missing_supabase_url_or_service_role");
  }

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const required = await probeMany(client, REQUIRED_CORE_TABLES);
  const support = await probeMany(client, SUPPORT_TABLES);
  const attention = await probeMany(client, ATTENTION_MARKER_TABLES);
  const classification = classifyRecoveryState({ required, support, attention });

  return {
    projectRef: url.replace(/^https:\/\//, "").split(".")[0],
    checkedAt: new Date().toISOString(),
    readOnly: true,
    required,
    support,
    attention,
    classification,
  };
}

async function main() {
  const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  const report = await runRecoveryPreflight({ url, serviceKey });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.classification.safeForMutationProbes ? 0 : 3);
}

const isDirectRun = Boolean(
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
);

if (isDirectRun) {
  main().catch((error) => {
    console.log(JSON.stringify({ ok: false, readOnly: true, error: String(error?.message || error) }, null, 2));
    process.exit(1);
  });
}
