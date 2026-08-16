import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SETTINGS_PANELS, NOTIFICATION_OPTIONS } from "../src/lib/settingsCatalog.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("accessibility regression smoke", () => {
  it("settings options include human-readable docs for SR/help", () => {
    for (const p of SETTINGS_PANELS) {
      assert.ok(p.description.length > 8, p.id);
      assert.ok(p.docs.length > 12, p.id);
    }
    for (const o of NOTIFICATION_OPTIONS) {
      assert.ok(o.description);
      assert.ok(o.docs);
    }
  });

  it("design tokens define mobile chrome / touch-friendly bottom inset", () => {
    const cssPath = join(root, "src", "index.css");
    assert.ok(existsSync(cssPath));
    const css = readFileSync(cssPath, "utf8");
    assert.match(css, /--mobile-chrome-bottom/);
  });

  it("OfflineIndicator copy is honest about device cache", () => {
    const path = join(root, "src", "components", "shared", "OfflineIndicator.jsx");
    const src = readFileSync(path, "utf8");
    assert.match(src, /offline/i);
    assert.match(src, /Device data|device cache|shell/i);
  });

  it("a11y announce helper exists", () => {
    const path = join(root, "src", "lib", "a11y.js");
    const src = readFileSync(path, "utf8");
    assert.match(src, /export function announce/);
    assert.match(src, /a11y-status/);
  });

  it("Invisible Interface associates validation errors and preserves touch targets", () => {
    const path = join(root, "src", "components", "ai", "InvisibleInterface.jsx");
    const src = readFileSync(path, "utf8");
    assert.match(src, /aria-invalid/);
    assert.match(src, /aria-describedby/);
    assert.match(src, /htmlFor=\{inputId\}/);
    assert.match(src, /min-h-11/);
  });
});
