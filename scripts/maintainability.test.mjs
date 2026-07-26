/**
 * Maintainability regression — architecture docs, barrels, MODULE maps.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

describe("maintainability docs", () => {
  it("ships architecture, onboarding, contributing", () => {
    for (const rel of ["ARCHITECTURE.md", "CONTRIBUTING.md", "docs/ONBOARDING.md", ".cursor/rules/maintainability.mdc"]) {
      assert.ok(existsSync(join(root, rel)), rel);
    }
    assert.match(read("README.md"), /ARCHITECTURE\.md/);
    assert.match(read("README.md"), /ONBOARDING\.md/);
  });

  it("feature MODULE.md exists for driver + export", () => {
    for (const rel of [
      "src/lib/driverActivity/MODULE.md",
      "src/lib/driverOs/MODULE.md",
      "src/lib/export/MODULE.md",
    ]) {
      assert.ok(existsSync(join(root, rel)), rel);
      assert.match(read(rel), /Public import|Public API/i);
    }
  });
});

describe("maintainability barrels", () => {
  it("driverActivity barrel exports gps + digests + classify", () => {
    const src = read("src/lib/driverActivity/index.js");
    assert.match(src, /gpsOwner/);
    assert.match(src, /analyticsDigest/);
    assert.match(src, /deliveryClassify/);
  });

  it("driverOs barrel exports snapshot + workflow events", () => {
    const src = read("src/lib/driverOs/index.js");
    assert.match(src, /buildMissionSnapshot/);
    assert.match(src, /DRIVER_SESSION_EVENT/);
    assert.match(src, /WORKFLOW_PHASE/);
    assert.ok(existsSync(join(root, "src/lib/driverOs/interfaces.js")));
  });

  it("shared UI barrel exports chrome triad", () => {
    const src = read("src/components/shared/index.js");
    assert.match(src, /PageShell/);
    assert.match(src, /EmptyState/);
    assert.match(src, /ExportMenu/);
  });

  it("Mission Control imports driverOs barrel", () => {
    assert.match(read("src/components/driver/os/MissionControl.jsx"), /from \"@\/lib\/driverOs\"/);
  });
});
