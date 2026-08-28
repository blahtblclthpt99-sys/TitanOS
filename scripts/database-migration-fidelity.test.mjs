import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const migrationsDir = join(repoRoot, "supabase", "migrations");
const manifestPath = join(here, "database-migration-fidelity.manifest.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const migrationSet = new Set(migrationFiles);
const readMigration = (name) => readFileSync(join(migrationsDir, name), "utf8");

const EXPECTED_LEDGER_SHA256 =
  "81307920564a7a6190a5fe0ff3d5d0ab252401e47e5cf764598ac1b47867429e";
const EXPECTED_PRE_ATTENTION_COUNT = 60;
const ALLOWED_CLASSIFICATIONS = new Set(["E", "R", "C", "S"]);

function replacementFiles(csv) {
  return csv.split(",").map((value) => value.trim()).filter(Boolean);
}

test("migration fidelity manifest describes the authoritative TitanOS boundary", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.project, "TitanOS");
  assert.equal(manifest.source.authoritativePreAttentionCount, EXPECTED_PRE_ATTENTION_COUNT);
  assert.equal(manifest.ledger.length, EXPECTED_PRE_ATTENTION_COUNT);
  assert.deepEqual(
    manifest.source.lastTitanOSMigration,
    ["20260818203624", "engagement_event_triggers"],
  );
  assert.deepEqual(
    manifest.source.attentionBoundary,
    ["20260818215755", "create_attention_marketplace_core"],
  );
});

test("authoritative ledger membership is immutable and uniquely keyed", () => {
  const versions = new Set();
  const namesByVersion = new Set();

  for (const row of manifest.ledger) {
    assert.equal(row.length, 4, `Malformed ledger row: ${JSON.stringify(row)}`);
    const [version, name, classification, target] = row;
    assert.match(version, /^\d{14}$/);
    assert.match(name, /^[a-z0-9_]+$/);
    assert.ok(ALLOWED_CLASSIFICATIONS.has(classification), `Unknown classification ${classification}`);
    assert.ok(target.length > 0, `Missing target for ${version}:${name}`);
    assert.ok(!versions.has(version), `Duplicate authoritative version ${version}`);
    versions.add(version);
    const key = `${version}:${name}`;
    assert.ok(!namesByVersion.has(key), `Duplicate authoritative ledger row ${key}`);
    namesByVersion.add(key);
  }

  const canonical = manifest.ledger
    .map(([version, name]) => `${version}:${name}`)
    .join("\n");
  const digest = createHash("sha256").update(canonical).digest("hex");

  assert.equal(digest, EXPECTED_LEDGER_SHA256);
  assert.equal(manifest.source.ledgerSha256, EXPECTED_LEDGER_SHA256);
});

test("restored and superseded ledger entries resolve to explicit local evidence", () => {
  for (const [version, name, classification, csv] of manifest.ledger) {
    const targets = replacementFiles(csv);
    assert.ok(targets.length >= 1, `No local evidence for ${version}:${name}`);

    for (const target of targets) {
      assert.ok(
        migrationSet.has(target),
        `Missing migration evidence ${target} for ${version}:${name}`,
      );
    }

    const exactHistoricalFile = `${version}_${name}.sql`;

    if (classification === "E") {
      assert.equal(
        targets.length,
        1,
        `Exact restoration ${version}:${name} must map to one file`,
      );
      assert.equal(
        targets[0],
        exactHistoricalFile,
        `Exact restoration filename drift for ${version}:${name}`,
      );
    }

    if (classification === "C" || classification === "S") {
      assert.ok(
        !migrationSet.has(exactHistoricalFile),
        `Superseded historical migration was reintroduced: ${exactHistoricalFile}`,
      );
    }
  }
});

test("reconstructed production drift remains narrowly documented", () => {
  for (const prerequisite of manifest.recoveryPrerequisites) {
    assert.ok(
      migrationSet.has(prerequisite.file),
      `Missing recovery prerequisite ${prerequisite.file}`,
    );
    assert.match(
      prerequisite.classification,
      /^(reconstructed_production_drift|compatibility_signature_only)$/,
    );

    const sql = readMigration(prerequisite.file);
    for (const marker of prerequisite.requiredMarkers ?? []) {
      assert.ok(
        sql.includes(marker),
        `${prerequisite.file} lost provenance/contract marker: ${marker}`,
      );
    }
    for (const marker of prerequisite.forbiddenMarkers ?? []) {
      assert.ok(
        !sql.includes(marker),
        `${prerequisite.file} introduced forbidden behavior: ${marker}`,
      );
    }
  }
});

test("Founding-25 experiment stays superseded by canonical Founding-100", () => {
  const founding25Versions = new Set(["20260813223541", "20260813223639"]);
  const rows = manifest.ledger.filter(([version]) => founding25Versions.has(version));
  assert.equal(rows.length, 2);

  for (const [version, name, classification, csv] of rows) {
    assert.equal(classification, "C", `${version}:${name} must remain contract-superseded`);
    assert.deepEqual(
      replacementFiles(csv),
      [
        "035_founding_100_beta.sql",
        "037_founding_trial_price_lock.sql",
        "20260828041500_platform_launch_integrity.sql",
      ],
    );
  }

  const allSql = migrationFiles.map(readMigration).join("\n");
  assert.ok(!allSql.includes("app_trial_started_at"));
  assert.ok(!allSql.includes("app_trial_ends_at"));

  const founding100 = readMigration("035_founding_100_beta.sql");
  const priceLock = readMigration("037_founding_trial_price_lock.sql");
  const integrity = readMigration("20260828041500_platform_launch_integrity.sql");

  assert.ok(founding100.includes("cap := 100"));
  assert.ok(priceLock.includes("Founding 100 = first month free + lifetime price lock"));
  assert.ok(priceLock.includes("founding_trial_ends_at"));
  assert.ok(integrity.includes("founding_claimed BETWEEN 0 AND founding_cap"));
});

test("profile privilege supersession retains stronger current controls", () => {
  const row = manifest.ledger.find(([version]) => version === "20260814155025");
  assert.ok(row, "Missing historical profile privilege lockdown entry");
  const [, name, classification, csv] = row;
  assert.equal(name, "lock_profile_privileges_unconditionally");
  assert.equal(classification, "S");
  assert.deepEqual(
    replacementFiles(csv),
    [
      "021_privilege_money_integrity.sql",
      "037_founding_trial_price_lock.sql",
      "20260816_lock_profile_privileged_columns.sql",
    ],
  );

  const triggerBase = readMigration("021_privilege_money_integrity.sql");
  const foundingProtection = readMigration("037_founding_trial_price_lock.sql");
  const columnGrants = readMigration("20260816_lock_profile_privileged_columns.sql");

  assert.ok(triggerBase.includes("protect_profile_privileges"));
  assert.ok(foundingProtection.includes("NEW.founding_user := OLD.founding_user"));
  assert.ok(columnGrants.includes("revoke update on table public.profiles from authenticated"));
  assert.ok(columnGrants.includes("grant update ("));
});

test("Attention takeover migrations are outside both ledger and recovery chain", () => {
  const ledgerNames = new Set(manifest.ledger.map(([, name]) => name));

  for (const forbiddenName of manifest.forbiddenMigrationNames) {
    assert.ok(!ledgerNames.has(forbiddenName), `Attention migration leaked into ledger: ${forbiddenName}`);
    assert.ok(
      !migrationFiles.some((file) => file.includes(forbiddenName)),
      `Attention migration leaked into recovery chain: ${forbiddenName}`,
    );
  }

  assert.equal(manifest.ledger.at(-1)[0], manifest.source.lastTitanOSMigration[0]);
  assert.equal(manifest.ledger.at(-1)[1], manifest.source.lastTitanOSMigration[1]);
  assert.ok(
    !manifest.ledger.some(
      ([version, name]) =>
        version === manifest.source.attentionBoundary[0] ||
        name === manifest.source.attentionBoundary[1],
    ),
  );
});

test("manifest and test remain present as recovery gate inputs", () => {
  assert.ok(existsSync(manifestPath));
  assert.ok(existsSync(fileURLToPath(import.meta.url)));
});
