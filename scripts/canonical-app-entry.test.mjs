import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../src/App.jsx");
const main = read("../src/main.jsx");
const css = read("../src/index.css");
const html = read("../index.html");
const manifest = read("../public/manifest.webmanifest");
const authBootstrap = read("../public/auth-bootstrap.js");
const configBanner = read("../src/components/shared/ConfigMissingBanner.jsx");

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

  it("uses the full TitanOS browser bootstrap instead of the Attention purge bootstrap", () => {
    for (const marker of [
      "initSentry();",
      "hydrateFeatureFlags();",
      "hydrateLaunchStatus();",
      "refreshFeatureFlagsFromServer()",
      "applyTheme(getStoredTheme())",
      'window.addEventListener("vite:preloadError"',
      "installNativeAuthDeepLinks",
      "navigator.serviceWorker.register('/sw.js')",
      "<ErrorBoundary",
    ]) {
      assert.ok(main.includes(marker), `missing TitanOS bootstrap marker: ${marker}`);
    }
    assert.doesNotMatch(main, /purgeLegacyClientState/);
    assert.doesNotMatch(main, /titan-attention/i);
  });

  it("loads the TitanOS Tailwind design system and local fonts", () => {
    assert.match(css, /@import\s+["']tailwindcss["']/);
    assert.match(css, /@config\s+["']\.\.\/tailwind\.config\.js["']/);
    assert.match(css, /TitanOS v2 Design System/);
    assert.match(css, /--titan-cyan:/);
    assert.match(css, /plus-jakarta-sans-latin\.woff2/);
    assert.doesNotMatch(css, /fonts\.googleapis\.com/);
    assert.doesNotMatch(css, /\.site-shell\s*\{/);
    assert.doesNotMatch(css, /\.budget-card\s*\{/);
  });

  it("keeps browser and PWA identity on TitanOS with strict-CSP-safe bootstrap", () => {
    assert.match(html, /<title>TitanOS/);
    assert.match(html, /Loading TitanOS/);
    assert.match(html, /href="\/favicon\.svg"/);
    assert.match(html, /href="\/manifest\.webmanifest"/);
    assert.match(html, /href="\/apple-touch-icon\.png"/);
    assert.match(html, /<script src="\/auth-bootstrap\.js"><\/script>/);
    assert.doesNotMatch(html, /<script(?![^>]*src=)[^>]*>[\s\S]*?<\/script>/i);
    assert.doesNotMatch(html, /Titan Attention/);
    assert.doesNotMatch(html, /\.vercel\.app/);

    assert.match(authBootstrap, /\/auth\/callback/);
    assert.match(authBootstrap, /window\.location\.replace/);
    assert.doesNotMatch(authBootstrap, /\.vercel\.app/);

    const pwa = JSON.parse(manifest);
    assert.equal(pwa.name, "TitanOS");
    assert.equal(pwa.short_name, "TitanOS");
    assert.equal(pwa.display, "standalone");
    assert.ok(pwa.icons.some((icon) => icon.src === "/pwa-192.png"));
    assert.ok(pwa.icons.some((icon) => icon.src === "/pwa-512.png"));
    assert.doesNotMatch(manifest, /Titan Attention/);
  });

  it("suppresses missing-config chrome only on isolated workers.dev previews", () => {
    assert.match(configBanner, /endsWith\(["']\.workers\.dev["']\)/);
    assert.match(configBanner, /if \(isIsolatedWorkersPreview\(\)\) return null/);
    assert.match(configBanner, /TitanOS is misconfigured/);
    assert.doesNotMatch(configBanner, /localhost|127\.0\.0\.1/);
  });

  it("cannot silently become the standalone Titan Attention application", () => {
    assert.doesNotMatch(app, /Titan Attention/);
    assert.doesNotMatch(app, /attention-api/);
    assert.doesNotMatch(app, /Verified human attention marketplace/);
    assert.doesNotMatch(app, /function\s+ViewerDashboard/);
    assert.doesNotMatch(app, /function\s+AdvertiserDashboard/);
  });
});
