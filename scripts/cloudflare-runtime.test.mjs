import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

describe("Cloudflare production runtime", () => {
  it("serves the Vite SPA through Workers static assets and sends APIs to the Worker first", () => {
    const raw = read("wrangler.jsonc").replace(/^\s*\/\/.*$/gm, "");
    const config = JSON.parse(raw);
    assert.equal(config.name, "titanos");
    assert.equal(config.main, "./worker/index.js");
    assert.equal(config.assets.directory, "./dist");
    assert.equal(config.assets.binding, "ASSETS");
    assert.equal(config.assets.not_found_handling, "single-page-application");
    assert.deepEqual(config.assets.run_worker_first, ["/api/*"]);
    assert.ok(new Date(config.compatibility_date) >= new Date("2026-08-04"));
    assert.equal(config.observability.enabled, true);
  });

  it("provides a bounded legacy API bridge including raw webhook bodies", () => {
    const worker = read("worker/index.js");
    assert.match(worker, /const ROUTES = new Map/);
    assert.match(worker, /\["stripeWebhook", stripeWebhook\]/);
    assert.match(worker, /\["jobMatchesV2", jobMatchesV2\]/);
    assert.match(worker, /\["auth\/me", authMe\]/);
    assert.match(worker, /\["titanAI", titanAILive\]/);
    assert.match(worker, /rawBody/);
    assert.match(worker, /Symbol\.asyncIterator/);
    assert.match(worker, /API route not found/);
    assert.match(worker, /Internal server error/);
  });

  it("keeps Cloudflare static security headers free of obsolete Vercel hosts", () => {
    const headers = read("public/_headers");
    assert.doesNotMatch(headers, /vercel/i);
    assert.match(headers, /Content-Security-Policy:/);
    assert.match(headers, /Strict-Transport-Security:/);
    assert.match(headers, /X-Content-Type-Options: nosniff/);
    assert.match(headers, /\/assets\/\*/);
  });

  it("uses the canonical TitanOS origin rather than Vercel in server CORS fallbacks", () => {
    const cors = read("api/_lib/cors.js");
    assert.doesNotMatch(cors, /titanos-web\.vercel\.app/);
    assert.match(cors, /https:\/\/titanos\.app/);
  });
});
