import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const manifestPath = resolve(root, "docs/INTEGRATION_MERGE_MANIFEST.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (["node_modules", "dist", "build"].includes(name)) return [];
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe("Titan unified-runtime contract", () => {
  it("declares the root as the only canonical Android runtime", () => {
    assert.equal(manifest.canonicalRuntime, ".");
    assert.equal(manifest.packageId, "com.titanos.myapp");
    const gradle = readFileSync(resolve(root, "android/app/build.gradle"), "utf8");
    const capacitor = readFileSync(resolve(root, "capacitor.config.json"), "utf8");
    assert.match(gradle, /applicationId\s+["']com\.titanos\.myapp["']/);
    assert.match(capacitor, /"appId"\s*:\s*"com\.titanos\.myapp"/);
  });

  it("keeps legacy app trees out of production runtime imports", () => {
    const runtimeFiles = [resolve(root, "src"), resolve(root, "api"), resolve(root, "shared")]
      .flatMap(walk)
      .filter((path) => /\.(?:js|jsx|ts|tsx)$/.test(path));
    for (const path of runtimeFiles) {
      const source = readFileSync(path, "utf8");
      assert.doesNotMatch(source, /(?:TitatnCl|\.\.\/TitanOS|\/TitanOS\/)/, relative(root, path));
    }
  });

  it("maps every Base44 page capability to a canonical TitanOS page", () => {
    for (const page of Object.values(manifest.base44PageMappings)) {
      assert.ok(existsSync(resolve(root, `src/pages/${page}.jsx`)), `Missing canonical page: ${page}`);
    }
  });

  it("maps every Base44 entity to a canonical or protected archive table", () => {
    const tables = readFileSync(resolve(root, "src/api/entityTables.js"), "utf8");
    const migrations = walk(resolve(root, "supabase/migrations"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    for (const table of Object.values(manifest.base44EntityMappings)) {
      assert.ok(tables.includes(`"${table}"`) || migrations.includes(table), `Unmapped table: ${table}`);
    }
    assert.ok(existsSync(resolve(root, manifest.systems.Base44.dataMigration)));
    assert.ok(existsSync(resolve(root, manifest.systems.Base44.archiveMigration)));
  });

  it("wires one Titan AI contract with allowlisted server actions", () => {
    for (const key of ["chatEndpoint", "capabilitiesEndpoint", "actionEndpoint", "ui"]) {
      assert.ok(existsSync(resolve(root, manifest.systems.TitanAI[key])), `Missing Titan AI ${key}`);
    }
    const capabilities = readFileSync(resolve(root, manifest.systems.TitanAI.capabilitiesEndpoint), "utf8");
    assert.match(capabilities, /ALLOWED_AI_INTENTS/);
    assert.match(capabilities, /Supabase Auth/);
  });

  it("integrates Cursor policy and import provenance without a runtime dependency", () => {
    assert.ok(existsSync(resolve(root, manifest.systems.Cursor.rules)));
    assert.ok(existsSync(resolve(root, manifest.systems.Cursor.memoryImporter)));
    assert.ok(existsSync(resolve(root, manifest.systems.Cursor.importTest)));
    const pkg = readFileSync(resolve(root, "package.json"), "utf8");
    assert.doesNotMatch(pkg, /["']cursor["']/i);
  });
});
