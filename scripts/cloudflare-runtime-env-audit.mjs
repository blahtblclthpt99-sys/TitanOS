import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'cloudflare', 'active-function-registry.js');

const importPatterns = [
  /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/g,
  /import\(\s*["']([^"']+)["']\s*\)/g,
  /require\(\s*["']([^"']+)["']\s*\)/g,
];
const envPatterns = [
  /process\.env\.([A-Z][A-Z0-9_]*)/g,
  /process\.env\[\s*["']([A-Z][A-Z0-9_]*)["']\s*\]/g,
];

async function resolveLocalImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, `${base}.js`, `${base}.mjs`, `${base}.cjs`, path.join(base, 'index.js')];
  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      // Continue through supported local-module shapes.
    }
  }
  return null;
}

const visited = new Set();
const queue = [entry];
const envToFiles = new Map();
const unresolvedLocalImports = [];

while (queue.length) {
  const file = queue.shift();
  if (!file || visited.has(file)) continue;
  visited.add(file);

  const source = await readFile(file, 'utf8');
  for (const pattern of envPatterns) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const key = match[1];
      if (!envToFiles.has(key)) envToFiles.set(key, new Set());
      envToFiles.get(key).add(path.relative(root, file));
    }
  }

  const specs = new Set();
  for (const pattern of importPatterns) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) specs.add(match[1]);
  }

  for (const specifier of specs) {
    if (!specifier.startsWith('.')) continue;
    const resolved = await resolveLocalImport(file, specifier);
    if (!resolved) {
      unresolvedLocalImports.push({ from: path.relative(root, file), specifier });
      continue;
    }
    if (!visited.has(resolved)) queue.push(resolved);
  }
}

const env = [...envToFiles]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, files]) => ({ name, files: [...files].sort() }));

console.log(JSON.stringify({
  activeEntry: path.relative(root, entry),
  filesScanned: visited.size,
  environmentVariables: env,
  unresolvedLocalImports,
}, null, 2));

if (unresolvedLocalImports.length) {
  console.error('Runtime environment audit found unresolved local imports.');
  process.exit(1);
}
