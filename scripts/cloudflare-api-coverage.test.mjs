import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const srcFiles = walk(join(root, "src"), (p) => /\.(?:js|jsx|ts|tsx)$/.test(p));
const serverFunctionNames = new Set(
  walk(join(root, "api", "functions"), (p) => p.endsWith(".js"))
    .map((p) => relative(join(root, "api", "functions"), p).replace(/\\/g, "/").replace(/\.js$/, "")),
);
const topLevelApiNames = new Set(
  readdirSync(join(root, "api"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => entry.name.replace(/\.js$/, "")),
);

function walk(dir, predicate = () => true) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full, predicate));
    else if (predicate(full)) out.push(full);
  }
  return out;
}

function invokedServerHandlers() {
  const invoked = new Set();
  const invokeRe = /(?:api\.)?functions\.invoke\(\s*["'`]([A-Za-z0-9_-]+)["'`]/g;
  for (const file of srcFiles) {
    const text = readFileSync(file, "utf8");
    let match;
    while ((match = invokeRe.exec(text))) invoked.add(match[1]);
  }
  return [...invoked].filter((name) => serverFunctionNames.has(name)).sort();
}

function directApiPaths() {
  const paths = new Set();
  const fetchRe = /fetch\s*\(\s*(?:`([^`]*)`|"([^"]*)"|'([^']*)')/g;
  const apiPathRe = /\/api\/[A-Za-z0-9_./-]+/g;
  for (const file of srcFiles) {
    const text = readFileSync(file, "utf8");
    let match;
    while ((match = fetchRe.exec(text))) {
      const target = match[1] ?? match[2] ?? match[3] ?? "";
      for (const path of target.match(apiPathRe) || []) paths.add(path);
    }
  }
  return [...paths].sort();
}

function registryFunctionImports() {
  const source = readFileSync(join(root, "cloudflare", "active-function-registry.js"), "utf8");
  const names = new Set();
  const importRe = /import\s+([A-Za-z0-9_]+)\s+from\s+["']\.\.\/api\/functions\/([A-Za-z0-9_-]+)\.js["'];/g;
  let match;
  while ((match = importRe.exec(source))) {
    assert.equal(match[1], match[2], `registry alias must match handler name: ${match[0]}`);
    names.add(match[2]);
  }
  return [...names].sort();
}

function registryTopLevelPaths() {
  const source = readFileSync(join(root, "cloudflare", "active-function-registry.js"), "utf8");
  const paths = new Set();
  const registryMatch = source.match(/ACTIVE_TOP_LEVEL_API_REGISTRY\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/);
  assert.ok(registryMatch, "ACTIVE_TOP_LEVEL_API_REGISTRY must exist");
  const pathRe = /["'](\/api\/[A-Za-z0-9_-]+)["']\s*:/g;
  let match;
  while ((match = pathRe.exec(registryMatch[1]))) paths.add(match[1]);
  return [...paths].sort();
}

test("Cloudflare function allowlist exactly covers invoked and direct browser handlers", () => {
  const invoked = invokedServerHandlers();
  const directFunctions = directApiPaths()
    .map((path) => path.match(/^\/api\/functions\/([A-Za-z0-9_-]+)$/)?.[1] || null)
    .filter((name) => name && serverFunctionNames.has(name));
  const expected = [...new Set([...invoked, ...directFunctions])].sort();
  const registered = registryFunctionImports();

  assert.equal(invoked.length, 36, `invoked handler baseline changed; found ${invoked.length}`);
  assert.equal(expected.length, 39, `combined active function surface changed; found ${expected.length}`);
  assert.deepEqual(registered, expected);
});

test("Cloudflare top-level API allowlist exactly covers direct browser handlers", () => {
  const expected = directApiPaths()
    .filter((path) => {
      const name = path.match(/^\/api\/([A-Za-z0-9_-]+)$/)?.[1] || null;
      return name && topLevelApiNames.has(name);
    })
    .sort();

  assert.deepEqual(expected, ["/api/register", "/api/signup-emails"]);
  assert.deepEqual(registryTopLevelPaths(), expected);
});

test("every direct browser API path has an explicit Cloudflare ownership model", () => {
  const paths = directApiPaths();
  const registeredFunctions = new Set(registryFunctionImports());
  const registeredTopLevel = new Set(registryTopLevelPaths());

  assert.deepEqual(paths, [
    "/api/attention/create-checkout",
    "/api/functions/analyticsIngest",
    "/api/functions/appVersion",
    "/api/functions/featureFlags",
    "/api/register",
    "/api/signup-emails",
  ]);

  for (const path of paths) {
    if (path === "/api/attention/create-checkout") continue;
    const fn = path.match(/^\/api\/functions\/([A-Za-z0-9_-]+)$/)?.[1] || null;
    if (fn) {
      assert.ok(registeredFunctions.has(fn), `direct function is not Cloudflare allowlisted: ${path}`);
      continue;
    }
    assert.ok(registeredTopLevel.has(path), `direct top-level API is not Cloudflare allowlisted: ${path}`);
  }
});

test("generic Stripe and Attention webhooks have distinct Cloudflare routes", () => {
  const worker = readFileSync(join(root, "cloudflare", "worker.js"), "utf8");
  assert.match(worker, /GENERIC_STRIPE_WEBHOOK_PATH\s*=\s*["']\/api\/functions\/stripeWebhook["']/);
  assert.match(worker, /ATTENTION_STRIPE_WEBHOOK_PATH\s*=\s*["']\/api\/attention\/stripe-webhook["']/);
  assert.match(worker, /runNodeHandler\(genericStripeWebhook, request\)/);
  assert.match(worker, /handleAttentionStripeWebhook\(request, env\)/);
});

test("unknown API routes remain fail-closed", () => {
  const worker = readFileSync(join(root, "cloudflare", "worker.js"), "utf8");
  assert.match(worker, /getActiveFunctionHandler\(name\)/);
  assert.match(worker, /getActiveTopLevelApiHandler\(url\.pathname\)/);
  assert.match(worker, /apiNotFound\(\)/);
});

test("server registration is email-confirmation safe by default on Cloudflare", () => {
  const registration = readFileSync(join(root, "api", "register.js"), "utf8");
  assert.doesNotMatch(registration, /VERCEL_ENV/);
  assert.match(registration, /REGISTER_REQUIRE_EMAIL_CONFIRM/);
  assert.match(registration, /const requireConfirm = flag === "false" \? false : true/);
});
