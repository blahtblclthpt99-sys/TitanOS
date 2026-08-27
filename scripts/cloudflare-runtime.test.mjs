import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

describe("Cloudflare production runtime", () => {
  it("serves the Vite SPA through Workers static assets and sends APIs to the Worker first", () => {
    const config = JSON.parse(read("wrangler.jsonc").replace(/^\s*\/\/.*$/gm, ""));
    assert.equal(config.name, "titanos");
    assert.equal(config.main, "./worker/index.js");
    assert.equal(config.vars.APP_ENV, "production");
    assert.equal(config.assets.directory, "./dist");
    assert.equal(config.assets.binding, "ASSETS");
    assert.equal(config.assets.not_found_handling, "single-page-application");
    assert.deepEqual(config.assets.run_worker_first, ["/api/*"]);
    assert.ok(new Date(config.compatibility_date) >= new Date("2026-08-04"));
    assert.equal(config.observability.enabled, true);
  });

  it("provides a bounded API bridge including root routes, nested routes, and raw webhook bodies", () => {
    const worker = read("worker/index.js");
    assert.match(worker, /const ROUTES = new Map/);
    assert.match(worker, /\["register", rootRegister\]/);
    assert.match(worker, /\["signup-emails", signupEmails\]/);
    assert.match(worker, /\["functions\/stripeWebhook", stripeWebhook\]/);
    assert.match(worker, /\["functions\/jobMatchesV2", jobMatchesV2\]/);
    assert.match(worker, /\["functions\/auth\/me", authMe\]/);
    assert.match(worker, /\["functions\/titanAI", titanAILive\]/);
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

  it("does not depend on Vercel runtime metadata in the Worker server instrument", () => {
    const instrument = read("api/instrument.mjs");
    assert.doesNotMatch(instrument, /VERCEL_/);
    assert.doesNotMatch(instrument, /@sentry\/profiling-node/);
    assert.match(instrument, /CLOUDFLARE_ENV/);
  });

  it("requires verification by default in production without relying on provider-specific metadata", () => {
    const register = read("api/register.js");
    assert.match(register, /process\.env\.APP_ENV/);
    assert.match(register, /shouldRequireEmailConfirmation/);
    assert.match(register, /runtime === "production" \|\| runtime === "prod"/);
    assert.match(register, /email_confirm:\s*!requireConfirm/);
  });
});
