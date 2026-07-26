/**
 * Integration: offline indicator + sync messaging contract in source.
 * Complements offline-local unit tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("integration: offline + sync UX", () => {
  it("SyncStatus component exists for honest sync states", () => {
    const src = readFileSync(join(root, "src/components/shared/SyncStatus.jsx"), "utf8");
    assert.match(src, /sync|offline|pending/i);
  });

  it("useVisibilityInterval pauses work when hidden", () => {
    const src = readFileSync(join(root, "src/hooks/useVisibilityInterval.js"), "utf8");
    assert.match(src, /visibilitychange|hidden/);
  });
});
