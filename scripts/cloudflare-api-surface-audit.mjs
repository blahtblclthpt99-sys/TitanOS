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
const directPaths = new Map();
const invokeRe = /(?:api\.)?functions\.invoke\(\s*["'`]([A-Za-z0-9_-]+)["'`]/g;
const fetchRe = /fetch\s*\(\s*(?:`([^`]*)`|"([^"]*)"|'([^']*)')/g;
const apiPathRe = /\/api\/[A-Za-z0-9_./-]+/g;

for (const file of srcFiles) {
  const text = readFileSync(file, "utf8");
  let match;
  while ((match = invokeRe.exec(text))) {
    const name = match[1];
    if (!invoked.has(name)) invoked.set(name, new Set());
    invoked.get(name).add(relative(root, file));
  }

  while ((match = fetchRe.exec(text))) {
    const target = match[1] ?? match[2] ?? match[3] ?? "";
    for (const path of target.match(apiPathRe) || []) {
      if (!directPaths.has(path)) directPaths.set(path, new Set());
      directPaths.get(path).add(relative(root, file));
    }
  }
}

const serverFiles = walk(join(root, "api", "functions"), (p) => p.endsWith(".js"));
const serverNames = new Set(
  serverFiles.map((p) => relative(join(root, "api", "functions"), p).replace(/\\/g, "/").replace(/\.js$/, "")),
);
const topLevelNames = new Set(
  readdirSync(join(root, "api"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => entry.name.replace(/\.js$/, "")),
);

const worker = readFileSync(join(root, "cloudflare", "worker.js"), "utf8");
const directlyOwned = new Set();
if (worker.includes('/api/attention/create-checkout')) directlyOwned.add("/api/attention/create-checkout");
if (worker.includes('/api/attention/stripe-webhook')) directlyOwned.add("/api/attention/stripe-webhook");
if (worker.includes('/api/functions/stripeWebhook')) directlyOwned.add("/api/functions/stripeWebhook");

const rows = [...invoked.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, files]) => ({
    name,
    files: [...files].sort(),
    server_handler: serverNames.has(name),
  }));

const directRows = [...directPaths.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, files]) => {
    const fn = path.match(/^\/api\/functions\/([A-Za-z0-9_-]+)$/)?.[1] || null;
    const top = path.match(/^\/api\/([A-Za-z0-9_-]+)$/)?.[1] || null;
    return {
      path,
      files: [...files].sort(),
      server_handler: fn ? serverNames.has(fn) : top ? topLevelNames.has(top) : false,
      cloudflare_direct: directlyOwned.has(path),
    };
  });

const activeHandlers = rows.filter((r) => r.server_handler).map((r) => r.name);
const directFunctionHandlers = directRows
  .map((r) => r.path.match(/^\/api\/functions\/([A-Za-z0-9_-]+)$/)?.[1] || null)
  .filter((name) => name && serverNames.has(name));
const directTopLevelPaths = directRows
  .filter((r) => /^\/api\/[A-Za-z0-9_-]+$/.test(r.path) && r.server_handler)
  .map((r) => r.path);

console.log(`ACTIVE_HANDLER_NAMES=${activeHandlers.join(",")}`);
console.log(`ACTIVE_HANDLER_COUNT=${activeHandlers.length}`);
console.log(`DIRECT_FUNCTION_HANDLER_NAMES=${directFunctionHandlers.join(",")}`);
console.log(`DIRECT_TOP_LEVEL_API_PATHS=${directTopLevelPaths.join(",")}`);
console.log(`DIRECT_API_PATHS=${directRows.map((r) => r.path).join(",")}`);
console.log(`DIRECT_API_COUNT=${directRows.length}`);
console.log(JSON.stringify({
  invoked_count: rows.length,
  invoked_server_handler_count: activeHandlers.length,
  direct_api_count: directRows.length,
  invoked: rows,
  direct: directRows,
}, null, 2));
