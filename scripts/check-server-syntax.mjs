import { readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = join(root, "api");

function collect(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collect(full, out);
      continue;
    }
    if (/\.(?:js|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

const files = collect(apiRoot).sort();
const failures = [];

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    failures.push({
      file: relative(root, file),
      stderr: String(result.stderr || result.stdout || "syntax check failed").trim(),
    });
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, checked: files.length, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checked: files.length }, null, 2));
