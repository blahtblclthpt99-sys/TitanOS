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

function md5(value) {
  return createHash("md5").update(value, "utf8").digest("hex");
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
});
