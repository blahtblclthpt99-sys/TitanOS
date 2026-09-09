import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  loadRecoveryManifest,
  migrationPolicy,
  validateRecoveryManifest,
} from "./db-recovery-manifest.mjs";

const manifest = loadRecoveryManifest();

describe("TitanOS database recovery migration governance", () => {
  it("hard-blocks the authoritative TitanOS purge migration", () => {
    const result = migrationPolicy("20260818220148", "purge_legacy_titanos_public_schema", manifest);
    assert.equal(result.classification, "NEVER_REPLAY");
  });

  it("hard-blocks historical destructive cleanup migrations", () => {
    for (const [version, name] of [
      ["20260814120204", "archive_and_remove_legacy_demo_fixture_records"],
      ["20260814120854", "archive_and_remove_explicit_test_auth_accounts"],
    ]) {
      assert.equal(migrationPolicy(version, name, manifest).classification, "NEVER_REPLAY");
    }
  });

  it("requires explicit staging review for stateful/backfill migrations", () => {
    for (const [version, name] of [
      ["20260813223541", "founding_25_lifetime_and_three_day_trial"],
      ["20260813223639", "reconcile_founding_25_backfill"],
      ["20260815203730", "contract_share_token_hashing"],
      ["20260817033826", "private_job_match_preferences"],
      ["20260817134320", "private_job_match_origin"],
      ["20260818220301", "enable_pg_net_for_storage_cleanup"],
    ]) {
      assert.equal(migrationPolicy(version, name, manifest).classification, "MANUAL_REVIEW");
    }
  });

  it("preserves the already-existing Attention schema instead of replaying it", () => {
    assert.equal(
      migrationPolicy("20260818215755", "create_attention_marketplace_core", manifest).classification,
      "PRESERVE_EXISTING_ATTENTION"
    );
  });

  it("fails closed for an unclassified historical migration", () => {
    assert.equal(migrationPolicy("20990101000000", "unknown_migration", manifest).classification, "BLOCK");
  });

  it("prohibits direct production replay and synthetic historical rows", () => {
    assert.equal(manifest.policy.directProductionReplay, "PROHIBITED");
    assert.equal(manifest.policy.reconstructionTarget, "ISOLATED_STAGING_ONLY");
    assert.equal(manifest.policy.unknownHistoricalMigration, "BLOCK");
    assert.equal(manifest.policy.historicalRows, "DO_NOT_SYNTHESIZE");
  });

  it("documents the historical 041 migration collision without renaming it", () => {
    const collision = manifest.historicalCollisions.find((entry) => entry.prefix === "041");
    assert.ok(collision);
    assert.deepEqual(new Set(collision.files), new Set([
      "041_titan_autopilot.sql",
      "041_google_play_subscriptions.sql",
    ]));
    assert.equal(collision.policy, "DO_NOT_RENAME_OR_REORDER_WITHOUT_LEDGER_RECONCILIATION");
  });

  it("validates the recovery manifest and confirms the purge SQL is absent from the recovery tree", () => {
    const report = validateRecoveryManifest(manifest);
    assert.equal(report.ok, true, report.errors.join(", "));
    assert.deepEqual(report.errors, []);
  });
});
