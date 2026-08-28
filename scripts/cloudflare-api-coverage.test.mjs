import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();

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
  for (const file of walk(join(root, "src"), (p) => /\.(?:js|jsx|ts|tsx)$/.test(p))) {
    const text = readFileSync(file, "utf8");
    let match;
    while ((match = invokeRe.exec(text))) invoked.add(match[1]);
  }

  const serverNames = new Set(
    walk(join(root, "api", "functions"), (p) => p.endsWith(".js"))
      .map((p) => relative(join(root, "api", "functions"), p).replace(/\\/g, "/").replace(/\.js$/, "")),
  );

  return [...invoked].filter((name) => serverNames.has(name)).sort();
}

function registryImports() {
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

test("all frontend-reachable privileged handlers are allowlisted for Cloudflare", () => {
  const invoked = invokedServerHandlers();
  const registered = registryImports();
  assert.equal(invoked.length, 36, `expected audited active handler count to remain explicit; found ${invoked.length}`);
  assert.deepEqual(registered, invoked);
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
  assert.match(worker, /apiNotFound\(\)/);
});
