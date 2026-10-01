#!/usr/bin/env node
/**
 * Static recovery governance for TitanOS migrations.
 *
 * This module never connects to Supabase and never executes SQL. It converts
 * the production-ledger recovery findings into fail-closed repository policy.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const MANIFEST_PATH = resolve(HERE, "../supabase/recovery/recovery-manifest.json");
export const MIGRATIONS_PATH = resolve(HERE, "../supabase/migrations");

export function loadRecoveryManifest(path = MANIFEST_PATH) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sameMigration(entry, version, name) {
  return String(entry?.version || "") === String(version || "") &&
    String(entry?.name || "") === String(name || "");
}

export function migrationPolicy(version, name, manifest = loadRecoveryManifest()) {
  const neverReplay = manifest.neverReplay.find((entry) => sameMigration(entry, version, name));
  if (neverReplay) return { classification: "NEVER_REPLAY", entry: neverReplay };

  const manualReview = manifest.manualReview.find((entry) => sameMigration(entry, version, name));
  if (manualReview) return { classification: "MANUAL_REVIEW", entry: manualReview };

  const attention = manifest.preserveExistingAttention.find((entry) => sameMigration(entry, version, name));
  if (attention) return { classification: "PRESERVE_EXISTING_ATTENTION", entry: attention };

  return {
    classification: "BLOCK",
    entry: null,
    reason: "Migration is not explicitly classified by the recovery manifest."
  };
}

export function validateRecoveryManifest(manifest = loadRecoveryManifest(), migrationsPath = MIGRATIONS_PATH) {
  const errors = [];

  if (manifest.schemaVersion !== 1) errors.push("unsupported_schema_version");
  if (manifest.policy?.directProductionReplay !== "PROHIBITED") errors.push("production_replay_must_be_prohibited");
  if (manifest.policy?.reconstructionTarget !== "ISOLATED_STAGING_ONLY") errors.push("reconstruction_must_be_staging_only");
  if (manifest.policy?.unknownHistoricalMigration !== "BLOCK") errors.push("unknown_migrations_must_block");
  if (manifest.policy?.historicalRows !== "DO_NOT_SYNTHESIZE") errors.push("historical_rows_must_not_be_synthesized");

  const groups = [manifest.neverReplay, manifest.manualReview, manifest.preserveExistingAttention];
  const seen = new Set();
  for (const group of groups) {
    if (!Array.isArray(group)) {
      errors.push("migration_policy_group_missing");
      continue;
    }
    for (const entry of group) {
      const key = `${entry.version}:${entry.name}`;
      if (seen.has(key)) errors.push(`duplicate_migration_policy:${key}`);
      seen.add(key);
    }
  }

  const purge = manifest.neverReplay?.find((entry) =>
    entry.version === "20260818220148" && entry.name === "purge_legacy_titanos_public_schema"
  );
  if (!purge) errors.push("purge_migration_not_never_replay");

  const collision = manifest.historicalCollisions?.find((entry) => entry.prefix === "041");
  const collisionFiles = new Set(collision?.files || []);
  if (!collision || !collisionFiles.has("041_titan_autopilot.sql") || !collisionFiles.has("041_google_play_subscriptions.sql")) {
    errors.push("historical_041_collision_not_documented");
  }
  if (collision?.policy !== "DO_NOT_RENAME_OR_REORDER_WITHOUT_LEDGER_RECONCILIATION") {
    errors.push("historical_041_collision_policy_not_fail_closed");
  }

  if (!existsSync(migrationsPath)) {
    errors.push("migrations_directory_missing");
  } else {
    const files = readdirSync(migrationsPath);
    if (files.some((file) => file.includes("purge_legacy_titanos_public_schema"))) {
      errors.push("destructive_purge_migration_present_in_recovery_tree");
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    manifestPath: MANIFEST_PATH,
    productionProjectRef: manifest.productionProjectRef,
    preAttentionSourceCommit: manifest.preAttentionSourceCommit,
    directProductionReplay: manifest.policy?.directProductionReplay || null,
    reconstructionTarget: manifest.policy?.reconstructionTarget || null
  };
}

async function main() {
  const report = validateRecoveryManifest();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 2);
}

const isDirectRun = Boolean(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url));
if (isDirectRun) {
  main().catch((error) => {
    console.error(JSON.stringify({ ok: false, error: String(error?.message || error) }, null, 2));
    process.exit(2);
  });
}
