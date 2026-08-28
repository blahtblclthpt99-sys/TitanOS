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

const srcFiles = walk(join(root, "src"), (p) => /\.(?:js|jsx|ts|tsx)$/.test(p));
const invoked = new Map();
const invokeRe = /(?:api\.)?functions\.invoke\(\s*["'`]([A-Za-z0-9_-]+)["'`]/g;

for (const file of srcFiles) {
  const text = readFileSync(file, "utf8");
  let match;
  while ((match = invokeRe.exec(text))) {
    const name = match[1];
    if (!invoked.has(name)) invoked.set(name, new Set());
    invoked.get(name).add(relative(root, file));
  }
}

const serverFiles = walk(join(root, "api", "functions"), (p) => p.endsWith(".js"));
const serverNames = new Set(serverFiles.map((p) => relative(join(root, "api", "functions"), p).replace(/\\/g, "/").replace(/\.js$/, "")));

const worker = readFileSync(join(root, "cloudflare", "worker.js"), "utf8");
const directlyOwned = new Set();
if (worker.includes('/api/attention/create-checkout')) directlyOwned.add("attention/create-checkout");
if (worker.includes('/api/functions/stripeWebhook')) directlyOwned.add("stripeWebhook");

const rows = [...invoked.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, files]) => ({
    name,
    files: [...files].sort(),
    server_handler: serverNames.has(name),
    cloudflare_direct: directlyOwned.has(name),
  }));

console.log(JSON.stringify({
  invoked_count: rows.length,
  server_handler_count: rows.filter((r) => r.server_handler).length,
  cloudflare_direct_count: rows.filter((r) => r.cloudflare_direct).length,
  invoked: rows,
}, null, 2));
