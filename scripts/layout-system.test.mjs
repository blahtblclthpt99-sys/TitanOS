import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";

const css = fs.readFileSync("src/index.css", "utf8");
const dashboard = fs.readFileSync("src/pages/Dashboard.jsx", "utf8");
const overview = fs.readFileSync("src/components/dashboard/OverviewTodayCard.jsx", "utf8");
const assistant = fs.readFileSync("src/pages/AIAssistant.jsx", "utf8");

describe("Titan spatial layout system", () => {
  it("defines bento, editorial, motion and depth primitives", () => {
    for (const token of [".titan-bento-grid", ".titan-editorial-header", ".titan-rolling-surface", ".titan-depth-card", ".titan-action-rail"]) {
      assert.ok(css.includes(token), `missing ${token}`);
    }
  });

  it("wires Command Center to the bento/editorial surface system", () => {
    assert.ok(dashboard.includes("titan-bento-grid"));
    assert.ok(dashboard.includes("titan-bento-item-wide"));
    assert.ok(dashboard.includes("titan-editorial-header"));
    assert.ok(dashboard.includes("titan-rolling-surface"));
  });

  it("keeps depth and action-history polish on the intended surfaces", () => {
    assert.ok(overview.includes("titan-depth-card"));
    assert.ok(overview.includes("titan-overview-grid"));
    assert.ok(assistant.includes("titan-action-rail"));
    assert.ok(assistant.includes("titan-action-chip"));
  });
});
