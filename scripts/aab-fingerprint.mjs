#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = process.cwd();

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function sha256File(path) {
  const data = readFileSync(path);
  return createHash("sha256").update(data).digest("hex");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  // This is the signed artifact produced by android:sign and submitted to Play.
  // The legacy download-directory bundle may be stale and must not be baselined.
  const aabPath = resolve(root, args.aabPath || "release/TitanOS.aab");
  const outPath = resolve(root, args.out || "ops/aab-baseline.json");

  if (!existsSync(aabPath)) {
    throw new Error(`AAB file not found: ${aabPath}`);
  }

  const st = statSync(aabPath);
  const record = {
    generatedAt: new Date().toISOString(),
    file: aabPath,
    bytes: st.size,
    sha256: sha256File(aabPath),
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(record, null, 2));
}

main();
