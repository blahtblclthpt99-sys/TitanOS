import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

describe("canonical TitanOS application entrypoint", () => {
  it("boots through the authenticated TitanOS shell", () => {
    assert.match(app, /import\s*\{\s*AuthProvider\s*,\s*useAuth\s*\}\s*from\s*["']@\/lib\/AuthContext["']/);
    assert.match(app, /lazy\(\(\)\s*=>\s*import\(["']\.\/AuthenticatedShell["']\)\)/);
    assert.match(app, /<AuthProvider>/);
    assert.match(app, /<AuthenticatedShell\s*\/>/);
    assert.match(app, /Loading TitanOS/);
  });

  it("preserves canonical public and protected routing boundaries", () => {
    for (const marker of [
      'path="/pricing"',
      'path="/download"',
      'path="/login"',
      'path="/register"',
      'path="/delete-account"',
      'path="/portal"',
      'path="/book/:slug"',
      'path="/u/:username"',
      'path="/sign/:token"',
      'path="/share/report/:token"',
    ]) {
      assert.ok(app.includes(marker), `missing canonical route marker: ${marker}`);
    }
    assert.match(app, /rememberReturnTo\(location\)/);
    assert.match(app, /resolveBookingSlugFromHost/);
    assert.match(app, /shouldUseHashRouter/);
  });

  it("cannot silently become the standalone Titan Attention application", () => {
    assert.doesNotMatch(app, /Titan Attention/);
    assert.doesNotMatch(app, /attention-api/);
    assert.doesNotMatch(app, /Verified human attention marketplace/);
    assert.doesNotMatch(app, /function\s+ViewerDashboard/);
    assert.doesNotMatch(app, /function\s+AdvertiserDashboard/);
  });
});
