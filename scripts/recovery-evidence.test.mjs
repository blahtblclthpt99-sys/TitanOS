import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = join(root, "supabase", "recovery", "staging-applied");
const manifestPath = join(evidenceDir, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const postEvidenceDir = join(root, "supabase", "recovery", "staging-post");
const postManifest = JSON.parse(readFileSync(join(postEvidenceDir, "manifest.json"), "utf8"));
const stagingTarget = JSON.parse(
  readFileSync(join(root, "supabase", "recovery", "staging-target-2026-09-10.json"), "utf8")
);
const productionBaseline = JSON.parse(
  readFileSync(join(root, "supabase", "recovery", "production-baseline-2026-09-10.json"), "utf8")
);

function md5(value) {
  return createHash("md5").update(value, "utf8").digest("hex");
}

function gitBlobSha(value) {
  const body = Buffer.from(value, "utf8");
  return createHash("sha1")
    .update(Buffer.from(`blob ${body.length}\0`, "utf8"))
    .update(body)
    .digest("hex");
}

describe("recovery staging evidence integrity", () => {
  it("keeps exactly 22 staged reconstruction SQL snapshots outside executable migrations", () => {
    assert.equal(manifest.entries.length, 22);
    const actual = readdirSync(evidenceDir).filter((name) => name.endsWith(".sql")).sort();
    const expected = manifest.entries.map((entry) => entry.file).sort();
    assert.deepEqual(actual, expected);

    for (const entry of manifest.entries) {
      const evidencePath = join(evidenceDir, entry.file);
      const executablePath = join(root, "supabase", "migrations", entry.file);
      assert.ok(existsSync(evidencePath), `missing recovery evidence: ${entry.file}`);
      assert.equal(existsSync(executablePath), false, `recovery evidence leaked into executable migrations: ${entry.file}`);
    }
  });

  for (const entry of manifest.entries) {
    it(`${entry.version} ${entry.name} matches the staging migration ledger`, () => {
      const sql = readFileSync(join(evidenceDir, entry.file), "utf8");
      assert.equal([...sql].length, entry.characters, `${entry.file} character count drifted`);
      assert.equal(md5(sql), entry.md5, `${entry.file} MD5 does not match staging ledger`);
    });
  }

  it("keeps post-reconstruction hardening as non-executable, byte-for-byte evidence", () => {
    assert.equal(postManifest.entries.length, 1);
    const entry = postManifest.entries[0];
    const evidencePath = join(postEvidenceDir, entry.file);
    const executablePath = join(root, "supabase", "migrations", entry.file);
    assert.ok(existsSync(evidencePath), `missing staging post-hardening evidence: ${entry.file}`);
    assert.equal(existsSync(executablePath), false, `staging post-hardening leaked into executable migrations: ${entry.file}`);

    const sql = readFileSync(evidencePath, "utf8");
    assert.equal([...sql].length, entry.characters, `${entry.file} character count drifted`);
    assert.equal(Buffer.byteLength(sql, "utf8"), entry.bytes, `${entry.file} byte count drifted`);
    assert.equal(md5(sql), entry.md5, `${entry.file} MD5 does not match staging ledger`);
    assert.equal(gitBlobSha(sql), entry.git_blob_sha, `${entry.file} Git blob SHA does not match staging ledger bytes`);
  });

  it("pins the certified staging target and preserves the Attention/Auth production baseline", () => {
    assert.equal(stagingTarget.public_schema.tables, 79);
    assert.equal(stagingTarget.public_schema.policies, 142);
    assert.equal(stagingTarget.public_schema.indexes, 219);
    assert.equal(stagingTarget.public_schema.public_functions, 16);
    assert.equal(stagingTarget.public_schema.private_functions, 7);
    assert.equal(stagingTarget.public_schema.application_triggers, 25);
    assert.equal(stagingTarget.performance.unindexed_public_foreign_keys, 0);
    assert.equal(stagingTarget.security.two_account_runtime_idor_test, "PENDING_AUTH_TEST_IDENTITIES");

    assert.equal(productionBaseline.public_schema.tables, 5);
    assert.equal(productionBaseline.auth.user_count, 1);
    assert.equal(productionBaseline.auth.preserve, true);
    assert.deepEqual(
      productionBaseline.public_schema.table_names.slice().sort(),
      [
        "attention_campaigns",
        "attention_payment_events",
        "attention_profiles",
        "attention_views",
        "attention_withdrawals",
      ].sort()
    );
    assert.ok(
      Object.values(productionBaseline.public_schema.table_row_counts).every((count) => count === 0),
      "captured Attention baseline row counts must remain explicit zero values"
    );
    assert.equal(
      stagingTarget.public_schema.table_names.some((name) => name.startsWith("attention_")),
      false,
      "TitanOS target must remain additive and must not replace Attention tables"
    );
  });
});
